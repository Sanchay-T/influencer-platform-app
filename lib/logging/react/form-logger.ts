'use client';

import { useCallback, useMemo } from 'react';
import { LogCategory, type LogContext, LogLevel } from '../types';
import { emitClientLog, getClientLogGates, mergeContext } from './helpers';
import { useUserActionLogger } from './user-action-logger';

// Breadcrumb: useFormLogger -> bridges form telemetry with user-action logger.

export function useFormLogger(formName: string) {
	const { warn: canLogWarn, info: canLogInfo, error: canLogError } = getClientLogGates();
	const userActionLogger = useUserActionLogger();

	const baseContext = useMemo<LogContext>(() => ({ formName }), [formName]);

	const logValidationError = useCallback(
		(field: string, error: string, context?: LogContext) => {
			if (!canLogWarn) {
				return;
			}

			emitClientLog(
				LogLevel.WARN,
				() => `Form validation error in ${formName}: ${field}`,
				() =>
					mergeContext(baseContext, {
						field,
						validationError: error,
						...context,
					}),
				LogCategory.UI
			);
		},
		[baseContext, canLogWarn, formName]
	);

	const logSubmissionStart = useCallback(
		(formData: unknown, context?: LogContext) => {
			userActionLogger.logFormSubmission(formName, formData, {
				submissionPhase: 'start',
				...context,
			});
		},
		[formName, userActionLogger]
	);

	const logSubmissionSuccess = useCallback(
		(responseData?: unknown, context?: LogContext) => {
			if (!canLogInfo) {
				return;
			}

			emitClientLog(
				LogLevel.INFO,
				() => `Form submission successful: ${formName}`,
				() =>
					mergeContext(baseContext, {
						submissionPhase: 'success',
						hasResponseData: !!responseData,
						...context,
					}),
				LogCategory.UI
			);
		},
		[baseContext, canLogInfo, formName]
	);

	const logSubmissionError = useCallback(
		(error: Error, context?: LogContext) => {
			if (!canLogError) {
				return;
			}

			emitClientLog(
				LogLevel.ERROR,
				() => `Form submission failed: ${formName}`,
				() =>
					mergeContext(baseContext, {
						submissionPhase: 'error',
						...context,
					}),
				LogCategory.UI,
				error
			);
		},
		[baseContext, canLogError, formName]
	);

	return {
		logValidationError,
		logSubmissionStart,
		logSubmissionSuccess,
		logSubmissionError,
	};
}
