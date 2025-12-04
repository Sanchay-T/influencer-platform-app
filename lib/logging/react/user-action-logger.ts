'use client';

import { useUser } from '@clerk/nextjs';
import { useCallback, useMemo } from 'react';
import { LogCategory, type LogContext, LogLevel } from '../types';
import { emitClientLog, getClientLogGates, mergeContext } from './helpers';

// Breadcrumb: useUserActionLogger -> user telemetry -> central logger.

export function useUserActionLogger() {
	const { user } = useUser();
	const { info: canLogInfo, error: canLogError } = getClientLogGates();

	const baseContext = useMemo<LogContext>(
		() => ({
			userId: user?.id,
			userEmail: user?.primaryEmailAddress?.emailAddress,
		}),
		[user?.id, user?.primaryEmailAddress?.emailAddress]
	);

	const logClick = useCallback(
		(elementId: string, context?: LogContext) => {
			if (!canLogInfo) {
				return;
			}

			emitClientLog(
				LogLevel.INFO,
				() => `User clicked: ${elementId}`,
				() =>
					mergeContext(baseContext, {
						action: 'click',
						elementId,
						...context,
					}),
				LogCategory.UI
			);
		},
		[baseContext, canLogInfo]
	);

	const logFormSubmission = useCallback(
		(formName: string, formData?: any, context?: LogContext) => {
			if (!canLogInfo) {
				return;
			}

			emitClientLog(
				LogLevel.INFO,
				() => `User submitted form: ${formName}`,
				() =>
					mergeContext(baseContext, {
						action: 'form_submit',
						formName,
						formFields: formData ? Object.keys(formData) : undefined,
						...context,
					}),
				LogCategory.UI
			);
		},
		[baseContext, canLogInfo]
	);

	const logNavigation = useCallback(
		(from: string, to: string, context?: LogContext) => {
			if (!canLogInfo) {
				return;
			}

			emitClientLog(
				LogLevel.INFO,
				() => `User navigated from ${from} to ${to}`,
				() =>
					mergeContext(baseContext, {
						action: 'navigation',
						fromPath: from,
						toPath: to,
						...context,
					}),
				LogCategory.UI
			);
		},
		[baseContext, canLogInfo]
	);

	const logSearch = useCallback(
		(searchTerm: string, searchType?: string, context?: LogContext) => {
			if (!canLogInfo) {
				return;
			}

			emitClientLog(
				LogLevel.INFO,
				() => `User performed search: ${searchTerm}`,
				() =>
					mergeContext(baseContext, {
						action: 'search',
						searchTerm,
						searchType,
						...context,
					}),
				LogCategory.SEARCH
			);
		},
		[baseContext, canLogInfo]
	);

	const logError = useCallback(
		(action: string, error: Error, context?: LogContext) => {
			if (!canLogError) {
				return;
			}

			emitClientLog(
				LogLevel.ERROR,
				() => `User action failed: ${action}`,
				() =>
					mergeContext(baseContext, {
						failedAction: action,
						...context,
					}),
				LogCategory.UI,
				error
			);
		},
		[baseContext, canLogError]
	);

	return {
		logClick,
		logFormSubmission,
		logNavigation,
		logSearch,
		logError,
	};
}
