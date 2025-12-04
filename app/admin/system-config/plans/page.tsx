'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface PlanItem {
	planKey: string;
	displayName: string;
	description?: string;
	campaignsLimit: number;
	creatorsLimit: number;
	isActive: boolean;
	features: any;
	updatedAt?: string;
}

export default function PlansAdminPage() {
	const [plans, setPlans] = useState<PlanItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [savingKey, setSavingKey] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				setLoading(true);
				const res = await fetch('/api/admin/plans');
				if (!res.ok) throw new Error('Unauthorized or failed to fetch');
				const data = await res.json();
				setPlans(data.plans || []);
			} catch (e: any) {
				toast.error(e?.message || 'Failed to load plans');
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const onSave = async (plan: PlanItem) => {
		try {
			setSavingKey(plan.planKey);
			const res = await fetch('/api/admin/plans', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					planKey: plan.planKey,
					update: {
						displayName: plan.displayName,
						description: plan.description,
						campaignsLimit: Number(plan.campaignsLimit),
						creatorsLimit: Number(plan.creatorsLimit),
						isActive: Boolean(plan.isActive),
						features: plan.features,
					},
				}),
			});
			const data = await res.json();
			if (!(res.ok && data.success)) throw new Error(data.error || 'Save failed');
			toast.success('Plan updated');
		} catch (e: any) {
			toast.error(e?.message || 'Failed to save plan');
		} finally {
			setSavingKey(null);
		}
	};

	if (loading) return <div className="p-6">Loading plans…</div>;

	return (
		<div className="p-6 space-y-4 max-w-5xl">
			<h1 className="text-2xl font-bold">Subscription Plans</h1>
			<div className="grid gap-4 md:grid-cols-2">
				{plans.map((plan, idx) => (
					<Card key={plan.planKey}>
						<CardHeader>
							<CardTitle className="flex items-center justify-between">
								<span>
									{plan.displayName} ({plan.planKey})
								</span>
								<span className="text-xs text-gray-500">
									{plan.updatedAt ? new Date(plan.updatedAt).toLocaleString() : ''}
								</span>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div>
								<label className="block text-sm text-gray-600 mb-1">Display Name</label>
								<Input
									value={plan.displayName}
									onChange={(e) => {
										const v = e.target.value;
										setPlans((p) => p.map((x, i) => (i === idx ? { ...x, displayName: v } : x)));
									}}
								/>
							</div>
							<div>
								<label className="block text-sm text-gray-600 mb-1">Description</label>
								<Textarea
									value={plan.description || ''}
									rows={2}
									onChange={(e) => {
										const v = e.target.value;
										setPlans((p) => p.map((x, i) => (i === idx ? { ...x, description: v } : x)));
									}}
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-sm text-gray-600 mb-1">Campaigns Limit</label>
									<Input
										type="number"
										value={plan.campaignsLimit}
										onChange={(e) => {
											const v = Number(e.target.value);
											setPlans((p) =>
												p.map((x, i) => (i === idx ? { ...x, campaignsLimit: v } : x))
											);
										}}
									/>
								</div>
								<div>
									<label className="block text-sm text-gray-600 mb-1">Creators Limit</label>
									<Input
										type="number"
										value={plan.creatorsLimit}
										onChange={(e) => {
											const v = Number(e.target.value);
											setPlans((p) =>
												p.map((x, i) => (i === idx ? { ...x, creatorsLimit: v } : x))
											);
										}}
									/>
								</div>
							</div>
							<div>
								<label className="block text-sm text-gray-600 mb-1">Features (JSON)</label>
								<Textarea
									rows={6}
									value={JSON.stringify(plan.features ?? {}, null, 2)}
									onChange={(e) => {
										try {
											const json = JSON.parse(e.target.value);
											setPlans((p) => p.map((x, i) => (i === idx ? { ...x, features: json } : x)));
										} catch {
											// do not update on invalid JSON
										}
									}}
								/>
							</div>
							<div className="flex gap-2">
								<Button disabled={savingKey === plan.planKey} onClick={() => onSave(plan)}>
									{savingKey === plan.planKey ? 'Saving…' : 'Save'}
								</Button>
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
