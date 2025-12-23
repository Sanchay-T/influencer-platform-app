'use client';

/**
 * React Query Provider
 *
 * Wraps the app with QueryClientProvider for data fetching and caching.
 * Includes DevTools in development for debugging queries.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

// Create client inside component to avoid SSR issues
function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30 * 1000,
				gcTime: 5 * 60 * 1000,
				refetchOnWindowFocus: false,
				retry: 2,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
	if (typeof window === 'undefined') {
		// Server: always make a new query client
		return makeQueryClient();
	}
	// Browser: make a new query client if we don't already have one
	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();
	}
	return browserQueryClient;
}

interface QueryProviderProps {
	children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			<ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
		</QueryClientProvider>
	);
}
