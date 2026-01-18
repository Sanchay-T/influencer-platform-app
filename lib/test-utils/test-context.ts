/**
 * Test Context Management
 *
 * Provides setup/teardown helpers for test isolation.
 * Ensures tests don't leak state between runs.
 *
 * @example
 * import { TestContext, withTestContext } from '@/lib/test-utils';
 *
 * describe('Campaign API', () => {
 *   const ctx = new TestContext();
 *
 *   beforeEach(() => ctx.setup());
 *   afterEach(() => ctx.teardown());
 *
 *   it('creates campaign', async () => {
 *     const user = await ctx.createUser();
 *     // test...
 *   });
 * });
 */

import { structuredConsole } from '@/lib/logging/console-proxy';
import type { MockCampaign, MockJob, MockUser } from './mock-factories';
import {
	createMockCampaign,
	createMockJob,
	createMockUser,
	resetIdCounter,
} from './mock-factories';

// =============================================================================
// Types
// =============================================================================

type CleanupFn = () => Promise<void> | void;

interface TestContextOptions {
	/**
	 * Whether to reset ID counter on setup
	 * @default true
	 */
	resetIds?: boolean;

	/**
	 * Whether to log debug info
	 * @default false
	 */
	debug?: boolean;
}

// =============================================================================
// Test Context Class
// =============================================================================

/**
 * Manages test lifecycle and cleanup
 *
 * Use this class to:
 * - Create test entities that are automatically cleaned up
 * - Ensure test isolation
 * - Track what was created during a test
 *
 * @example
 * const ctx = new TestContext();
 *
 * // In beforeEach:
 * await ctx.setup();
 *
 * // In test:
 * const user = await ctx.createUser({ currentPlan: 'viral_surge' });
 *
 * // In afterEach:
 * await ctx.teardown();
 */
export class TestContext {
	private cleanupFns: CleanupFn[] = [];
	private createdUsers: MockUser[] = [];
	private createdCampaigns: MockCampaign[] = [];
	private createdJobs: MockJob[] = [];
	private options: TestContextOptions;

	constructor(options: TestContextOptions = {}) {
		this.options = {
			resetIds: true,
			debug: false,
			...options,
		};
	}

	/**
	 * Call at the start of each test
	 */
	async setup(): Promise<void> {
		if (this.options.resetIds) {
			resetIdCounter();
		}

		if (this.options.debug) {
			structuredConsole.debug('[TestContext] Setup complete');
		}
	}

	/**
	 * Call at the end of each test to clean up
	 */
	async teardown(): Promise<void> {
		// Run cleanup functions in reverse order (LIFO)
		const fns = [...this.cleanupFns].reverse();
		for (const fn of fns) {
			try {
				await fn();
			} catch (error) {
				if (this.options.debug) {
					structuredConsole.error('[TestContext] Cleanup error', error);
				}
			}
		}

		// Reset state
		this.cleanupFns = [];
		this.createdUsers = [];
		this.createdCampaigns = [];
		this.createdJobs = [];

		if (this.options.debug) {
			structuredConsole.debug('[TestContext] Teardown complete');
		}
	}

	/**
	 * Register a cleanup function to run during teardown
	 */
	onCleanup(fn: CleanupFn): void {
		this.cleanupFns.push(fn);
	}

	/**
	 * Create a mock user for testing
	 *
	 * The user is tracked and can be cleaned up automatically.
	 *
	 * @example
	 * const user = await ctx.createUser({ currentPlan: 'fame_flex' });
	 */
	async createUser(overrides: Partial<MockUser> = {}): Promise<MockUser> {
		const user = createMockUser(overrides);
		this.createdUsers.push(user);

		if (this.options.debug) {
			structuredConsole.debug(`[TestContext] Created user: ${user.userId}`);
		}

		return user;
	}

	/**
	 * Create a mock campaign for testing
	 *
	 * @example
	 * const campaign = await ctx.createCampaign({
	 *   userId: user.userId,
	 *   name: 'Test Search'
	 * });
	 */
	async createCampaign(overrides: Partial<MockCampaign> = {}): Promise<MockCampaign> {
		const campaign = createMockCampaign(overrides);
		this.createdCampaigns.push(campaign);

		if (this.options.debug) {
			structuredConsole.debug(`[TestContext] Created campaign: ${campaign.id}`);
		}

		return campaign;
	}

	/**
	 * Create a mock job for testing
	 *
	 * @example
	 * const job = await ctx.createJob({
	 *   userId: user.userId,
	 *   campaignId: campaign.id,
	 *   platform: 'instagram'
	 * });
	 */
	async createJob(overrides: Partial<MockJob> = {}): Promise<MockJob> {
		const job = createMockJob(overrides);
		this.createdJobs.push(job);

		if (this.options.debug) {
			structuredConsole.debug(`[TestContext] Created job: ${job.id}`);
		}

		return job;
	}

	/**
	 * Get all users created in this context
	 */
	getUsers(): MockUser[] {
		return [...this.createdUsers];
	}

	/**
	 * Get all campaigns created in this context
	 */
	getCampaigns(): MockCampaign[] {
		return [...this.createdCampaigns];
	}

	/**
	 * Get all jobs created in this context
	 */
	getJobs(): MockJob[] {
		return [...this.createdJobs];
	}

	/**
	 * Create test auth headers for API testing
	 *
	 * @example
	 * const headers = ctx.authHeaders(user.userId);
	 * const response = await fetch('/api/campaigns', {
	 *   headers: { ...headers, 'Content-Type': 'application/json' }
	 * });
	 */
	authHeaders(userId: string, email?: string): Record<string, string> {
		return {
			'x-test-user-id': userId,
			'x-test-email': email || `${userId}@test.com`,
		};
	}

	/**
	 * Create a base URL for API testing
	 *
	 * @example
	 * const baseUrl = ctx.apiUrl('/api/campaigns');
	 * // Returns 'http://localhost:3000/api/campaigns'
	 */
	apiUrl(path: string, port: number = 3000): string {
		const base = process.env.TEST_BASE_URL || `http://localhost:${port}`;
		return `${base}${path}`;
	}
}

// =============================================================================
// Helper Function
// =============================================================================

/**
 * Run a test with automatic setup/teardown
 *
 * @example
 * await withTestContext(async (ctx) => {
 *   const user = await ctx.createUser();
 *   // test with user...
 * }); // Automatic cleanup
 */
export async function withTestContext<T>(
	fn: (ctx: TestContext) => Promise<T>,
	options?: TestContextOptions
): Promise<T> {
	const ctx = new TestContext(options);
	await ctx.setup();

	try {
		return await fn(ctx);
	} finally {
		await ctx.teardown();
	}
}

// =============================================================================
// API Test Helpers
// =============================================================================

/**
 * Create a fetch wrapper with test auth headers
 *
 * @example
 * const testFetch = createTestFetch('user_123');
 * const response = await testFetch('/api/campaigns', { method: 'POST' });
 */
export function createTestFetch(
	userId: string,
	baseUrl: string = 'http://localhost:3000'
): (path: string, options?: RequestInit) => Promise<Response> {
	const ctx = new TestContext();
	const headers = ctx.authHeaders(userId);

	return async (path: string, options: RequestInit = {}): Promise<Response> => {
		const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

		return fetch(url, {
			...options,
			headers: {
				...headers,
				'Content-Type': 'application/json',
				...options.headers,
			},
		});
	};
}
