'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TrialStatusSkeletonProps {
	className?: string;
}

export function TrialStatusSkeleton({ className = '' }: TrialStatusSkeletonProps) {
	return (
		<Card className={`${className} border-gray-200 shadow-sm`}>
			<CardHeader className="pb-4">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
					{/* Title skeleton */}
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse"></div>
						<div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
					</div>
					{/* Badge skeleton */}
					<div className="h-6 bg-gray-200 rounded-full w-24 animate-pulse"></div>
				</div>
				{/* Description skeleton */}
				<div className="mt-1 h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
			</CardHeader>

			<CardContent className="space-y-6">
				{/* Countdown Display skeleton */}
				<div className="text-center">
					<div className="h-10 bg-gray-200 rounded w-32 mx-auto mb-2 animate-pulse"></div>
					<div className="h-4 bg-gray-200 rounded w-24 mx-auto animate-pulse"></div>
				</div>

				{/* Progress Bar skeleton */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
						<div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
					</div>
					<Progress value={0} className="h-2 bg-gray-200" />
				</div>

				{/* Trial Dates skeleton */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div className="flex items-start gap-3">
						<div className="w-4 h-4 bg-gray-200 rounded mt-0.5 animate-pulse"></div>
						<div className="space-y-1 flex-1">
							<div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
							<div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
						</div>
					</div>
					<div className="flex items-start gap-3">
						<div className="w-4 h-4 bg-gray-200 rounded mt-0.5 animate-pulse"></div>
						<div className="space-y-1 flex-1">
							<div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
							<div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default TrialStatusSkeleton;
