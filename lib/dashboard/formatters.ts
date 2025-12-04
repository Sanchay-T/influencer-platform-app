// Dashboard > formatters.ts => shared by favorite grid & recent lists renderers

// Used by app/components/dashboard/favorite-influencers-grid.tsx to condense follower metrics on cards
export function formatFollowerCount(value: number | null | undefined): string {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return '--';
	}

	const absValue = Math.abs(value);
	const prefix = value < 0 ? '-' : '';

	const thresholds = [
		{ limit: 1_000_000_000, suffix: 'B', divisor: 1_000_000_000 },
		{ limit: 1_000_000, suffix: 'M', divisor: 1_000_000 },
		{ limit: 1_000, suffix: 'K', divisor: 1_000 },
	] as const;

	for (const { limit, suffix, divisor } of thresholds) {
		if (absValue >= limit) {
			const scaled = absValue / divisor;
			const rounded = scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
			const text = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
			return `${prefix}${text}${suffix}`;
		}
	}

	return `${prefix}${Math.round(absValue)}`;
}

// Used by app/components/dashboard/recent-lists.tsx to render list recency in dashboard
export function formatRelativeTime(
	value: string | Date | null | undefined,
	referenceDate: Date = new Date()
): string {
	if (!value) return '--';
	const target = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(target.getTime())) return '--';

	const diffMs = target.getTime() - referenceDate.getTime();
	const diffMinutes = Math.round(diffMs / 60000);

	const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
		['year', 60 * 24 * 365],
		['month', 60 * 24 * 30],
		['week', 60 * 24 * 7],
		['day', 60 * 24],
		['hour', 60],
		['minute', 1],
	];

	const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	for (const [unit, minutesPerUnit] of units) {
		if (Math.abs(diffMinutes) >= minutesPerUnit || unit === 'minute') {
			const value = Math.round(diffMinutes / minutesPerUnit);
			return formatter.format(value, unit);
		}
	}

	return 'just now';
}
