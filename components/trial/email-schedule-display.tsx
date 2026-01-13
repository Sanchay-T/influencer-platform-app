'use client';

import { AlertCircle, Calendar, CheckCircle, Clock, Mail, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isRecord, isString } from '@/lib/utils/type-guards';

interface EmailScheduleItem {
	type: string;
	status: 'sent' | 'scheduled' | 'failed' | 'cancelled';
	timestamp?: string;
	scheduledFor?: string;
	messageId?: string;
}

interface EmailScheduleDisplayProps {
	emailScheduleStatus: Record<string, unknown>;
	className?: string;
}

export function EmailScheduleDisplay({
	emailScheduleStatus,
	className = '',
}: EmailScheduleDisplayProps) {
	// Parse email schedule status
	const getEmailSchedules = (): EmailScheduleItem[] => {
		if (
			!emailScheduleStatus ||
			typeof emailScheduleStatus !== 'object' ||
			Object.keys(emailScheduleStatus).length === 0
		) {
			return [];
		}

		const schedules: EmailScheduleItem[] = [];

		const isScheduleStatus = (value: unknown): value is EmailScheduleItem['status'] => {
			return (
				value === 'sent' || value === 'scheduled' || value === 'failed' || value === 'cancelled'
			);
		};

		// Process each email type
		Object.entries(emailScheduleStatus).forEach(([emailType, data]) => {
			if (!isRecord(data)) return;
			const status = isScheduleStatus(data.status) ? data.status : 'scheduled';
			schedules.push({
				type: emailType,
				status,
				timestamp: isString(data.timestamp) ? data.timestamp : undefined,
				scheduledFor: isString(data.scheduledFor) ? data.scheduledFor : undefined,
				messageId: isString(data.messageId) ? data.messageId : undefined,
			});
		});

		return schedules;
	};

	const emailSchedules = getEmailSchedules();

	const getEmailTypeLabel = (type: string): string => {
		const labels: Record<string, string> = {
			welcome: 'Welcome Email',
			abandonment: 'Trial Abandonment',
			trial_day2: 'Day 2 Reminder',
			trial_day5: 'Day 5 Reminder',
			trial_expiry: 'Trial Expiry Notice',
		};
		return labels[type] || type;
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case 'sent':
				return <CheckCircle className="h-4 w-4 text-chart-1" />;
			case 'scheduled':
				return <Clock className="h-4 w-4 text-zinc-300" />;
			case 'failed':
				return <AlertCircle className="h-4 w-4 text-red-500" />;
			case 'cancelled':
				return <AlertCircle className="h-4 w-4 text-zinc-500" />;
			default:
				return <Mail className="h-4 w-4 text-zinc-400" />;
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'sent':
				return (
					<Badge
						variant="secondary"
						className="bg-chart-1/20 text-chart-1 border border-chart-1/30"
					>
						Sent
					</Badge>
				);
			case 'scheduled':
				return (
					<Badge
						variant="secondary"
						className="bg-zinc-800/60 text-zinc-200 border border-zinc-700/50"
					>
						Scheduled
					</Badge>
				);
			case 'failed':
				return <Badge variant="destructive">Failed</Badge>;
			case 'cancelled':
				return (
					<Badge
						variant="secondary"
						className="bg-zinc-800/60 text-zinc-300 border border-zinc-700/50"
					>
						Cancelled
					</Badge>
				);
			default:
				return <Badge variant="outline">Unknown</Badge>;
		}
	};

	const formatTimestamp = (timestamp?: string): string => {
		if (!timestamp) return 'Not set';
		try {
			const date = new Date(timestamp);
			return date.toLocaleString();
		} catch {
			return 'Invalid date';
		}
	};

	if (emailSchedules.length === 0) {
		return null; // Don't show card if no email data - handled by parent component
	}

	return (
		<Card className={`${className} bg-zinc-900/80 border border-zinc-700/50`}>
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
					<Send className="h-5 w-5 text-zinc-300" />
					<span className="font-semibold">Email Schedule</span>
				</CardTitle>
				<CardDescription className="mt-1 text-zinc-400">
					Trial email sequence status and timing
				</CardDescription>
			</CardHeader>

			<CardContent>
				<div className="space-y-4">
					{emailSchedules.map((schedule, index) => (
						<div
							key={index}
							className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
						>
							<div className="flex-shrink-0 mt-0.5">{getStatusIcon(schedule.status)}</div>

							<div className="flex-1 min-w-0">
								<div className="flex items-center justify-between mb-2">
									<h4 className="font-medium text-zinc-100">{getEmailTypeLabel(schedule.type)}</h4>
									{getStatusBadge(schedule.status)}
								</div>

								<div className="space-y-1 text-sm text-zinc-400">
									{schedule.status === 'sent' && schedule.timestamp && (
										<div className="flex items-center gap-2">
											<CheckCircle className="h-3 w-3 text-chart-1" />
											<span>Sent: {formatTimestamp(schedule.timestamp)}</span>
										</div>
									)}

									{schedule.status === 'scheduled' && schedule.scheduledFor && (
										<div className="flex items-center gap-2">
											<Calendar className="h-3 w-3 text-zinc-300" />
											<span>Scheduled for: {formatTimestamp(schedule.scheduledFor)}</span>
										</div>
									)}

									{schedule.messageId && (
										<div className="flex items-center gap-2 mt-1">
											<Mail className="h-3 w-3 text-zinc-400 flex-shrink-0" />
											<code className="text-xs bg-zinc-900/60 text-zinc-200 px-2 py-1 rounded border border-zinc-700/50 break-all">
												{schedule.messageId}
											</code>
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Summary */}
				<div className="mt-6 pt-4 border-t border-zinc-700/50">
					<div className="grid grid-cols-3 gap-4 text-center">
						<div>
							<div className="text-2xl font-bold text-chart-1">
								{emailSchedules.filter((s) => s.status === 'sent').length}
							</div>
							<div className="text-xs text-zinc-500">Sent</div>
						</div>
						<div>
							<div className="text-2xl font-bold text-zinc-300">
								{emailSchedules.filter((s) => s.status === 'scheduled').length}
							</div>
							<div className="text-xs text-zinc-500">Scheduled</div>
						</div>
						<div>
							<div className="text-2xl font-bold text-red-600">
								{emailSchedules.filter((s) => s.status === 'failed').length}
							</div>
							<div className="text-xs text-zinc-500">Failed</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default EmailScheduleDisplay;
