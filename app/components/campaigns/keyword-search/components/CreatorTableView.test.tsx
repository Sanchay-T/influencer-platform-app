// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RowData } from './CreatorTableRow';
import { CreatorTableView } from './CreatorTableView';

// Mock the heavy child components to keep tests focused
vi.mock('./CreatorTableHeader', () => ({
	CreatorTableHeader: () => (
		<thead data-testid="table-header">
			<tr>
				<th>Header</th>
			</tr>
		</thead>
	),
}));

vi.mock('./CreatorTableRow', async () => {
	const actual = await vi.importActual('./CreatorTableRow');
	return {
		...actual,
		CreatorTableRow: ({ row, isBlurred }: { row: RowData; isBlurred: boolean }) => (
			<tr data-testid={`row-${row.id}`} data-blurred={isBlurred ? 'true' : 'false'}>
				<td>{row.snapshot.handle}</td>
			</tr>
		),
	};
});

vi.mock('@/components/ui/table', () => ({
	Table: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
		<table {...props}>{children}</table>
	),
	TableBody: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
		<tbody {...props}>{children}</tbody>
	),
}));

function makeRows(count: number): RowData[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `row-${i}`,
		snapshot: {
			platform: 'tiktok',
			externalId: `ext-${i}`,
			handle: `user${i}`,
			displayName: `User ${i}`,
			avatarUrl: null,
			url: `https://tiktok.com/@user${i}`,
			followers: 1000 + i,
			engagementRate: null,
			category: null,
			metadata: {},
		},
		raw: { username: `user${i}` },
	}));
}

const noopFn = () => {
	// Intentionally empty (used for callback props)
};
const noopAsync = async () => null;

const defaultProps = {
	selectedCreators: {},
	allSelectedOnPage: false,
	someSelectedOnPage: false,
	platformNormalized: 'tiktok',
	bioLoading: false,
	viewMode: 'table',
	onSelectPage: noopFn,
	toggleSelection: noopFn,
	renderProfileLink: () => '#',
	getBioDataForCreator: () => null,
	getBioEmailForCreator: () => null,
	getEnrichment: () => null,
	isEnrichmentLoading: () => false,
	enrichCreator: noopAsync,
	applyEnrichmentToCreators: noopFn,
	setBioEmailConfirmDialog: noopFn,
} as const;

describe('CreatorTableView blur with startIndex', () => {
	it('blurs all rows when startIndex exceeds trialClearLimit', () => {
		const rows = makeRows(10);
		render(
			<CreatorTableView
				{...defaultProps}
				rows={rows}
				isTrialUser={true}
				trialClearLimit={25}
				startIndex={50}
			/>
		);

		// startIndex=50, trialClearLimit=25: all 10 rows should be blurred
		// visibleRows = slice(0, max(0, 25 + 5 - 50)) = slice(0, 0) => no rows visible
		const renderedRows = screen.queryAllByTestId(/^row-/);
		// With startIndex=50 and limit=25+5=30, 30-50= -20 => max(0,-20)=0, no rows shown
		expect(renderedRows.length).toBe(0);
	});

	it('blurs rows correctly on page 1 with startIndex=0', () => {
		const rows = makeRows(30);
		render(
			<CreatorTableView
				{...defaultProps}
				rows={rows}
				isTrialUser={true}
				trialClearLimit={25}
				startIndex={0}
			/>
		);

		// visibleRows = slice(0, max(0, 25 + 5 - 0)) = slice(0, 30) => all 30 rows
		const renderedRows = screen.getAllByTestId(/^row-/);
		expect(renderedRows.length).toBe(30);

		// First 25 should be unblurred (startIndex + index < 25)
		for (let i = 0; i < 25; i++) {
			expect(renderedRows[i].getAttribute('data-blurred')).toBe('false');
		}

		// Last 5 should be blurred (startIndex + index >= 25)
		for (let i = 25; i < 30; i++) {
			expect(renderedRows[i].getAttribute('data-blurred')).toBe('true');
		}
	});

	it('does not blur rows for non-trial users', () => {
		const rows = makeRows(10);
		render(
			<CreatorTableView
				{...defaultProps}
				rows={rows}
				isTrialUser={false}
				trialClearLimit={25}
				startIndex={50}
			/>
		);

		const renderedRows = screen.getAllByTestId(/^row-/);
		expect(renderedRows.length).toBe(10);
		for (const row of renderedRows) {
			expect(row.getAttribute('data-blurred')).toBe('false');
		}
	});

	it('handles partial blur on a middle page', () => {
		// Page where startIndex=20, trialClearLimit=25, 10 rows
		// Rows 0-4 (global 20-24) unblurred, rows 5-9 (global 25-29) blurred
		const rows = makeRows(10);
		render(
			<CreatorTableView
				{...defaultProps}
				rows={rows}
				isTrialUser={true}
				trialClearLimit={25}
				startIndex={20}
			/>
		);

		// visibleRows = slice(0, max(0, 25+5-20)) = slice(0, 10) => all 10 rows
		const renderedRows = screen.getAllByTestId(/^row-/);
		expect(renderedRows.length).toBe(10);

		// First 5 unblurred (global indices 20-24)
		for (let i = 0; i < 5; i++) {
			expect(renderedRows[i].getAttribute('data-blurred')).toBe('false');
		}

		// Last 5 blurred (global indices 25-29)
		for (let i = 5; i < 10; i++) {
			expect(renderedRows[i].getAttribute('data-blurred')).toBe('true');
		}
	});
});
