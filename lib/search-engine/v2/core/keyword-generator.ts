/**
 * Keyword Generator Class
 *
 * Dynamically generates and manages keywords for search.
 */

import { generateContinuationKeywords } from './ai-expansion';
import { LOG_PREFIX } from './config';
import {
	DEFAULT_EXPANSION_CONFIG,
	expandKeywordsForTarget,
	type KeywordExpansionConfig,
} from './keyword-expander';

// ============================================================================
// Types
// ============================================================================

export interface KeywordExpansionState {
	/** All keywords that have been tried */
	processedKeywords: Set<string>;

	/** Original seed keywords from user */
	originalKeywords: string[];

	/** Current expansion round */
	expansionRun: number;

	/** Keywords waiting to be processed */
	pendingKeywords: string[];
}

// ============================================================================
// Keyword Generator Class
// ============================================================================

/**
 * Keyword generator that can dynamically add more keywords
 * as existing ones get exhausted
 */
export class KeywordGenerator {
	private originalKeywords: string[];
	private targetCreators: number;
	private config: KeywordExpansionConfig;
	private state: KeywordExpansionState;
	private isExpanding = false;

	constructor(
		originalKeywords: string[],
		targetCreators: number,
		config: KeywordExpansionConfig = DEFAULT_EXPANSION_CONFIG
	) {
		this.originalKeywords = originalKeywords;
		this.targetCreators = targetCreators;
		this.config = config;
		this.state = {
			processedKeywords: new Set(),
			originalKeywords: [...originalKeywords],
			expansionRun: 0,
			pendingKeywords: [],
		};
	}

	/**
	 * Initialize with expanded keywords
	 */
	async initialize(): Promise<string[]> {
		if (!this.config.enableExpansion) {
			this.state.pendingKeywords = [...this.originalKeywords];
			for (const kw of this.originalKeywords) {
				this.state.processedKeywords.add(kw.toLowerCase().trim());
			}
			return this.state.pendingKeywords;
		}

		const { keywords, processedKeywords } = await expandKeywordsForTarget(
			this.originalKeywords,
			this.targetCreators,
			this.config
		);

		this.state.pendingKeywords = keywords;
		for (const kw of processedKeywords) {
			this.state.processedKeywords.add(kw.toLowerCase().trim());
		}

		return keywords;
	}

	/**
	 * Mark a keyword as used (remove from pending)
	 */
	markUsed(keyword: string): void {
		const idx = this.state.pendingKeywords.indexOf(keyword);
		if (idx !== -1) {
			this.state.pendingKeywords.splice(idx, 1);
		}
	}

	/**
	 * Get remaining pending keywords
	 */
	getPendingKeywords(): string[] {
		return [...this.state.pendingKeywords];
	}

	/**
	 * Check if more keywords are available
	 */
	hasMoreKeywords(): boolean {
		return this.state.pendingKeywords.length > 0;
	}

	/**
	 * Check if we can expand more keywords
	 */
	canExpand(): boolean {
		return (
			this.config.enableExpansion &&
			this.state.expansionRun < this.config.maxExpansionRuns &&
			this.state.processedKeywords.size < this.config.maxKeywordsTotal
		);
	}

	/**
	 * Expand more keywords (if allowed)
	 * Returns new keywords added
	 */
	async expandMore(): Promise<string[]> {
		if (!this.canExpand() || this.isExpanding) {
			return [];
		}

		this.isExpanding = true;
		this.state.expansionRun++;

		try {
			const newKeywords = await generateContinuationKeywords(
				this.originalKeywords,
				Array.from(this.state.processedKeywords),
				this.state.expansionRun,
				this.config.keywordsPerExpansion
			);

			const added: string[] = [];
			for (const kw of newKeywords) {
				const normalized = kw.toLowerCase().trim();
				if (!this.state.processedKeywords.has(normalized)) {
					this.state.processedKeywords.add(normalized);
					this.state.pendingKeywords.push(kw);
					added.push(kw);
				}
			}

			console.log(
				`${LOG_PREFIX} Expansion run ${this.state.expansionRun}: +${added.length} keywords`
			);

			return added;
		} finally {
			this.isExpanding = false;
		}
	}

	/**
	 * Get total processed keywords count
	 */
	getProcessedCount(): number {
		return this.state.processedKeywords.size;
	}

	/**
	 * Get expansion run count
	 */
	getExpansionRun(): number {
		return this.state.expansionRun;
	}
}
