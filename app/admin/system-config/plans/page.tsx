'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
	getArrayProperty,
	getBooleanProperty,
	getNumberProperty,
	getStringProperty,
	toRecord,
} from '@/lib/utils/type-guards';

interface PlanItem {
	planKey: string;
	displayName: string;
	description?: string;
	campaignsLimit: number;
	creatorsLimit: number;
	isActive: boolean;
	features: unknown;
	updatedAt?: string;
}

function parsePlanItem(value: unknown): PlanItem | null {
	const record = toRecord(value);
	if (!record) {
		return null;
	}

	const planKey = getStringProperty(record, 'planKey');
	const displayName = getStringProperty(record, 'displayName');
	if (!(planKey && displayName)) {
		return null;
	}

	const description = typeof record.description === 'string' ? record.description : undefined;
	const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : undefined;

	return {
		planKey,
		displayName,
		description,
		campaignsLimit: getNumberProperty(record, 'campaignsLimit') ?? 0,
		creatorsLimit: getNumberProperty(record, 'creatorsLimit') ?? 0,
		isActive: getBooleanProperty(record, 'isActive') ?? false,
		features: record.features ?? {},
		updatedAt,
	};
}

function resolveErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
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
				if (!res.ok) {
					throw new Error('Unauthorized or failed to fetch');
				}
				const data = await res.json();
				const record = toRecord(data);
				const rawPlans = record ? (getArrayProperty(record, 'plans') ?? []) : [];
				const parsedPlans = rawPlans
					.map((plan) => parsePlanItem(plan))
					.filter((plan): plan is PlanItem => plan !== null);
				setPlans(parsedPlans);
			} catch (e: unknown) {
				toast.error(resolveErrorMessage(e, 'Failed to load plans'));
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
			const record = toRecord(data);
			const success = record ? record.success === true : false;
			const errorMessage = record ? getStringProperty(record, 'error') : null;
			if (!(res.ok && success)) {
				throw new Error(errorMessage || 'Save failed');
			}
			toast.success('Plan updated');
		} catch (e: unknown) {
			toast.error(resolveErrorMessage(e, 'Failed to save plan'));
		} finally {
			setSavingKey(null);
		}
	};

	if (loading) {
		return <div className="p-6">Loading plans…</div>;
	}

	return (
		<div className="p-6 space-y-4 max-w-5xl">
			<h1 className="text-2xl font-bold">Subscription Plans</h1>
			<div className="grid gap-4 md:grid-cols-2">
				{plans.map((plan, idx) => {
					const planId = `plan-${plan.planKey}`;
					return (
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
									<label
										htmlFor={`${planId}-display-name`}
										className="block text-sm text-gray-600 mb-1"
									>
										Display Name
									</label>
									<Input
										id={`${planId}-display-name`}
										value={plan.displayName}
										onChange={(e) => {
											const v = e.target.value;
											setPlans((p) => p.map((x, i) => (i === idx ? { ...x, displayName: v } : x)));
										}}
									/>
								</div>
								<div>
									<label
										htmlFor={`${planId}-description`}
										className="block text-sm text-gray-600 mb-1"
									>
										Description
									</label>
									<Textarea
										id={`${planId}-description`}
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
										<label
											htmlFor={`${planId}-campaigns-limit`}
											className="block text-sm text-gray-600 mb-1"
										>
											Campaigns Limit
										</label>
										<Input
											id={`${planId}-campaigns-limit`}
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
										<label
											htmlFor={`${planId}-creators-limit`}
											className="block text-sm text-gray-600 mb-1"
										>
											Creators Limit
										</label>
										<Input
											id={`${planId}-creators-limit`}
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
									<label
										htmlFor={`${planId}-features`}
										className="block text-sm text-gray-600 mb-1"
									>
										Features (JSON)
									</label>
									<Textarea
										id={`${planId}-features`}
										rows={6}
										value={JSON.stringify(plan.features ?? {}, null, 2)}
										onChange={(e) => {
											try {
												const json = JSON.parse(e.target.value);
												setPlans((p) =>
													p.map((x, i) => (i === idx ? { ...x, features: json } : x))
												);
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
					);
				})}
			</div>
		</div>
	);
}
