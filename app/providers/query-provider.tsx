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
import { useState } from 'react';

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

interface QueryProviderProps {
	children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
	// useState ensures same QueryClient instance across renders
	// and avoids hydration mismatch
	const [queryClient] = useState(() => makeQueryClient());

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{process.env.NODE_ENV === 'development' && (
				<ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
			)}
		</QueryClientProvider>
	);
}
