import { Skeleton } from '@/components/ui/skeleton';

export default function CampaignsLoading() {
	return (
		<div className="min-h-screen bg-zinc-950 p-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10 rounded-md bg-zinc-800" />
					<div>
						<Skeleton className="h-6 w-32 bg-zinc-800" />
						<Skeleton className="h-4 w-64 mt-1 bg-zinc-800" />
					</div>
				</div>
				<Skeleton className="h-9 w-32 bg-zinc-800" />
			</div>

			{/* Campaign cards skeleton */}
			<div className="grid gap-4">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-24 w-full rounded-xl bg-zinc-800" />
				))}
			</div>
		</div>
	);
}
