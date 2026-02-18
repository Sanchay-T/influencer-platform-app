import { Skeleton } from '@/components/ui/skeleton';

export default function ListsLoading() {
	return (
		<div className="min-h-screen bg-zinc-950 p-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10 rounded-md bg-zinc-800" />
					<div>
						<Skeleton className="h-6 w-24 bg-zinc-800" />
						<Skeleton className="h-4 w-48 mt-1 bg-zinc-800" />
					</div>
				</div>
				<Skeleton className="h-9 w-28 bg-zinc-800" />
			</div>

			{/* List cards skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<Skeleton key={i} className="h-32 w-full rounded-xl bg-zinc-800" />
				))}
			</div>
		</div>
	);
}
