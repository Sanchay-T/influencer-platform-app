import { isAdminUser } from '@/lib/auth/admin-utils';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { LogCategory } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { rejectSubmission } from '@/lib/services/social-sharing';
import { toError } from '@/lib/utils/type-guards';

export const POST = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
	logPhase('auth');

	const isAdmin = await isAdminUser();
	if (!isAdmin) {
		log.warn('Admin API unauthorized access attempt', { requestId }, LogCategory.ADMIN);
		return createErrorResponse('Unauthorized', 401, requestId);
	}

	// Get admin's internal ID for audit trail
	const { userId: adminClerkId } = await getAuthOrTest();
	if (!adminClerkId) {
		return createErrorResponse('Unauthorized', 401, requestId);
	}
	const adminProfile = await getUserProfile(adminClerkId);
	if (!adminProfile) {
		return createErrorResponse('Admin profile not found', 404, requestId);
	}

	logPhase('validation');

	const body = await req.json();
	const submissionId =
		typeof body === 'object' && body !== null && 'submissionId' in body
			? String(body.submissionId)
			: '';
	const reason =
		typeof body === 'object' && body !== null && 'reason' in body
			? String(body.reason)
			: '';

	if (!submissionId) {
		return createErrorResponse('submissionId is required', 400, requestId);
	}
	if (!reason.trim()) {
		return createErrorResponse('Rejection reason is required', 400, requestId);
	}

	logPhase('business');

	try {
		const result = await rejectSubmission({
			submissionId,
			adminInternalId: adminProfile.id,
			reason: reason.trim(),
		});

		log.info('Social sharing submission rejected via API', {
			requestId,
			metadata: { submissionId, adminId: adminProfile.id },
		}, LogCategory.ADMIN);

		return createApiResponse(result, 200, requestId);
	} catch (error) {
		const err = toError(error);
		// Business logic errors → 400
		if (
			err.message.includes('not found') ||
			err.message.includes('already') ||
			err.message.includes('Cannot')
		) {
			return createErrorResponse(err.message, 400, requestId);
		}

		log.error('Failed to reject submission', err, { requestId }, LogCategory.ADMIN);
		return createErrorResponse('Failed to reject submission', 500, requestId);
	}
}, LogCategory.ADMIN);
