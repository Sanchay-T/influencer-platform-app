import crypto from 'crypto';
import { createCategoryLogger, LogCategory } from '@/lib/logging';
import UserSessionLogger from '@/lib/logging/user-session-logger';

type Level = 'info' | 'debug' | 'error';

export interface OnboardingLogContext {
	userId?: string;
	email?: string | null;
	requestId?: string;
	step?: string | null;
	plan?: string | null;
	stripeStatus?: string | null;
	data?: Record<string, unknown>;
}

const cat = createCategoryLogger(LogCategory.ONBOARDING);

function hashEmail(email?: string | null) {
	if (!email) return null;
	return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function serialize(ctx: OnboardingLogContext, level: Level, evt: string) {
	const emailHash = hashEmail(ctx.email);
	return {
		level,
		evt,
		userId: ctx.userId,
		emailHash,
		requestId: ctx.requestId,
		step: ctx.step,
		plan: ctx.plan,
		stripeStatus: ctx.stripeStatus,
		data: ctx.data,
	};
}

function writePerUser(ctx: OnboardingLogContext, evt: string, message: string) {
	if (!ctx.email) return;
	const logger = UserSessionLogger.forUser(ctx.email, ctx.userId);
	logger.log(
		evt,
		message,
		{
			step: ctx.step,
			plan: ctx.plan,
			requestId: ctx.requestId,
			stripeStatus: ctx.stripeStatus,
		},
		'onboarding'
	);
}

export function logMilestone(evt: string, message: string, ctx: OnboardingLogContext = {}) {
	const payload = serialize(ctx, 'info', evt);
	cat.info(message, { userId: ctx.userId, metadata: payload });
	writePerUser(ctx, evt, message);
}

export function logDebug(evt: string, message: string, ctx: OnboardingLogContext = {}) {
	if (process.env.DEBUG_ONBOARDING !== '1') return;
	const payload = serialize(ctx, 'debug', evt);
	cat.debug(message, { userId: ctx.userId, metadata: payload });
}

export function logError(evt: string, error: Error, ctx: OnboardingLogContext = {}) {
	const payload = serialize(ctx, 'error', evt);
	cat.error(messageFromError(error), error, { userId: ctx.userId, metadata: payload });
	writePerUser(ctx, evt, messageFromError(error));
}

function messageFromError(err: Error) {
	return err?.message || 'Unknown error';
}
