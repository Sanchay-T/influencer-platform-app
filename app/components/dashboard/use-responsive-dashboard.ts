import { useEffect, useState } from 'react';

interface DashboardSizes {
	// Donut chart
	donutSize: number;
	donutStroke: number;

	// Bars
	barHeight: string;
	barSpacing: string;
	barLabelWidth: string;

	// Activity
	activitySpacing: string;
	activityPadding: string;
}

const BREAKPOINTS = {
	mobile: 0,
	tablet: 640,
	desktop: 1024,
	large: 1280,
	xlarge: 1536,
};

// Default sizes (desktop) for SSR and initial render
const DEFAULT_SIZES: DashboardSizes = {
	donutSize: 120,
	donutStroke: 14,
	barHeight: 'h-2',
	barSpacing: 'space-y-3',
	barLabelWidth: 'w-20',
	activitySpacing: 'space-y-2',
	activityPadding: 'py-1',
};

function getSizesForWidth(width: number): DashboardSizes {
	// Mobile: < 640px
	if (width < BREAKPOINTS.tablet) {
		return {
			donutSize: 90,
			donutStroke: 10,
			barHeight: 'h-1.5',
			barSpacing: 'space-y-2',
			barLabelWidth: 'w-16',
			activitySpacing: 'space-y-1.5',
			activityPadding: 'py-0.5',
		};
	}

	// Tablet: 640-1023px
	if (width < BREAKPOINTS.desktop) {
		return {
			donutSize: 100,
			donutStroke: 12,
			barHeight: 'h-2',
			barSpacing: 'space-y-2.5',
			barLabelWidth: 'w-18',
			activitySpacing: 'space-y-2',
			activityPadding: 'py-1',
		};
	}

	// Desktop: 1024-1279px
	if (width < BREAKPOINTS.large) {
		return {
			donutSize: 110,
			donutStroke: 14,
			barHeight: 'h-2',
			barSpacing: 'space-y-3',
			barLabelWidth: 'w-20',
			activitySpacing: 'space-y-2',
			activityPadding: 'py-1',
		};
	}

	// Large: 1280-1535px (typical MacBook)
	if (width < BREAKPOINTS.xlarge) {
		return {
			donutSize: 120,
			donutStroke: 14,
			barHeight: 'h-2',
			barSpacing: 'space-y-3',
			barLabelWidth: 'w-20',
			activitySpacing: 'space-y-2',
			activityPadding: 'py-1',
		};
	}

	// XLarge: 1536px+ (external monitors)
	return {
		donutSize: 130,
		donutStroke: 16,
		barHeight: 'h-2.5',
		barSpacing: 'space-y-4',
		barLabelWidth: 'w-24',
		activitySpacing: 'space-y-3',
		activityPadding: 'py-1.5',
	};
}

export function useResponsiveDashboard(): DashboardSizes {
	const [sizes, setSizes] = useState<DashboardSizes>(DEFAULT_SIZES);

	useEffect(() => {
		// Set initial size based on window width
		setSizes(getSizesForWidth(window.innerWidth));

		let timeoutId: ReturnType<typeof setTimeout>;

		const handleResize = () => {
			// Debounce resize events (150ms)
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				setSizes(getSizesForWidth(window.innerWidth));
			}, 150);
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			clearTimeout(timeoutId);
		};
	}, []);

	return sizes;
}

export type { DashboardSizes };
