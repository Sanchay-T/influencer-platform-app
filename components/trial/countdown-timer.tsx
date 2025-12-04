'use client';

import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { type TrialData, useTrialCountdown } from '@/lib/hooks/useTrialCountdown';

interface CountdownTimerProps {
	trialData: TrialData | null;
	showIcon?: boolean;
	showProgress?: boolean;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
}

export function CountdownTimer({
	trialData,
	showIcon = true,
	showProgress = false,
	size = 'md',
	className = '',
}: CountdownTimerProps) {
	const countdown = useTrialCountdown(trialData);

	if (!trialData) {
		return (
			<div className={`flex items-center gap-2 text-gray-500 ${className}`}>
				{showIcon && <Clock className="h-4 w-4" />}
				<span className="text-sm">No trial active</span>
			</div>
		);
	}

	const getSizeClasses = () => {
		switch (size) {
			case 'sm':
				return {
					container: 'text-sm',
					time: 'text-lg font-semibold',
					icon: 'h-4 w-4',
					progress: 'h-1',
				};
			case 'lg':
				return {
					container: 'text-lg',
					time: 'text-3xl font-bold',
					icon: 'h-6 w-6',
					progress: 'h-3',
				};
			default:
				return {
					container: 'text-base',
					time: 'text-2xl font-bold',
					icon: 'h-5 w-5',
					progress: 'h-2',
				};
		}
	};

	const getStatusIcon = () => {
		if (countdown.isExpired) {
			return <AlertTriangle className={`${sizeClasses.icon} text-red-500`} />;
		}
		if (countdown.daysRemaining <= 1) {
			return <AlertTriangle className={`${sizeClasses.icon} text-orange-500`} />;
		}
		return <Clock className={`${sizeClasses.icon} text-blue-500`} />;
	};

	const getStatusColor = () => {
		if (countdown.isExpired) return 'text-red-600';
		if (countdown.daysRemaining <= 1) return 'text-orange-600';
		return 'text-blue-600';
	};

	const sizeClasses = getSizeClasses();

	return (
		<div className={`${sizeClasses.container} ${className}`}>
			<div className="flex items-center gap-2 mb-2">
				{showIcon && getStatusIcon()}
				<div className={`${sizeClasses.time} ${getStatusColor()}`}>{countdown.timeUntilExpiry}</div>
			</div>

			<div className="text-gray-600">
				{countdown.isExpired ? 'Trial has expired' : 'remaining in trial'}
			</div>

			{showProgress && (
				<div className="mt-3 space-y-1">
					<div className="flex items-center justify-between text-xs text-gray-500">
						<span>Progress</span>
						<span>{countdown.progressPercentage}%</span>
					</div>
					<div className={`w-full bg-gray-200 rounded-full ${sizeClasses.progress}`}>
						<div
							className={`${sizeClasses.progress} rounded-full transition-all duration-300 ${
								countdown.isExpired
									? 'bg-red-500'
									: countdown.daysRemaining <= 1
										? 'bg-orange-500'
										: 'bg-blue-500'
							}`}
							style={{ width: `${countdown.progressPercentage}%` }}
						/>
					</div>
				</div>
			)}

			{countdown.isLoading && <div className="text-xs text-gray-400 mt-1">Updating...</div>}

			{countdown.error && <div className="text-xs text-red-500 mt-1">{countdown.error}</div>}
		</div>
	);
}

export default CountdownTimer;
