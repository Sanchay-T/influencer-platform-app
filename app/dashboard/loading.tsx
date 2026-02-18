import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
	return (
		<div className="min-h-screen bg-zinc-950 p-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<Skeleton className="h-8 w-32 bg-zinc-800" />
					<Skeleton className="h-4 w-48 mt-2 bg-zinc-800" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-28 bg-zinc-800" />
					<Skeleton className="h-9 w-28 bg-zinc-800" />
				</div>
			</div>

			{/* Bento grid skeleton */}
			<div className="grid grid-cols-12 gap-4">
				{/* Hero card */}
				<div className="col-span-12 lg:col-span-7">
					<Skeleton className="h-48 w-full rounded-xl bg-zinc-800" />
				</div>
				<div className="col-span-6 lg:col-span-3">
					<Skeleton className="h-48 w-full rounded-xl bg-zinc-800" />
				</div>
				<div className="col-span-6 lg:col-span-2">
					<Skeleton className="h-48 w-full rounded-xl bg-zinc-800" />
				</div>

				{/* Row 2 */}
				<div className="col-span-12 sm:col-span-4 lg:col-span-2">
					<Skeleton className="h-40 w-full rounded-xl bg-zinc-800" />
				</div>
				<div className="col-span-12 sm:col-span-8 lg:col-span-10">
					<Skeleton className="h-40 w-full rounded-xl bg-zinc-800" />
				</div>

				{/* Row 3 */}
				<div className="col-span-12 sm:col-span-6 lg:col-span-4">
					<Skeleton className="h-52 w-full rounded-xl bg-zinc-800" />
				</div>
				<div className="col-span-12 sm:col-span-6 lg:col-span-4">
					<Skeleton className="h-52 w-full rounded-xl bg-zinc-800" />
				</div>
				<div className="col-span-12 lg:col-span-4">
					<Skeleton className="h-52 w-full rounded-xl bg-zinc-800" />
				</div>
			</div>
		</div>
	);
}
