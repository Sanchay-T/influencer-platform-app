/**
 * Sidebar insights card for list detail page
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ListDetail } from '../types/list-detail';
import { average, formatFollowers, formatPercent, topCategory } from '../utils/list-helpers';

interface ListInsightsProps {
	detail: ListDetail;
}

export function ListInsights({ detail }: ListInsightsProps) {
	return (
		<Card className="bg-zinc-900/80 border border-zinc-700/40">
			<CardHeader>
				<CardTitle className="text-sm text-zinc-200">List insights</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<InsightRow
					label="Average ER"
					value={formatPercent(
						average(detail.items.map((item) => item.creator.engagementRate ?? 0))
					)}
				/>
				<InsightRow label="Top category" value={topCategory(detail.items)} />
				<InsightRow label="Creators" value={detail.list.creatorCount} />
				<InsightRow label="Followers" value={formatFollowers(detail.list.followerSum)} />
			</CardContent>
		</Card>
	);
}

interface InsightRowProps {
	label: string;
	value: string | number;
}

function InsightRow({ label, value }: InsightRowProps) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-zinc-400">{label}</span>
			<span className="font-semibold text-zinc-200">{value}</span>
		</div>
	);
}
