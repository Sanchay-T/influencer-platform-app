'use client';

import Link from 'next/link';
import DashboardLayout from '@/app/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';

export default function ListDetailTimeoutClient({ listId }: { listId: string }) {
	return (
		<DashboardLayout>
			<div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
				<div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 p-6 shadow-sm">
					<h1 className="text-xl font-semibold text-zinc-100">
						This list is taking too long to load
					</h1>
					<p className="mt-2 text-sm text-zinc-400">
						Auto-enrichment should never block list access. This usually means a temporary DB/API
						stall. Try again in a few seconds.
					</p>

					<div className="mt-5 flex flex-wrap items-center gap-2">
						<Button asChild className="bg-pink-600 text-white hover:bg-pink-500">
							<a href={`/lists/${listId}`}>Retry</a>
						</Button>
						<Button asChild variant="outline">
							<Link href="/lists">Back to lists</Link>
						</Button>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
}

