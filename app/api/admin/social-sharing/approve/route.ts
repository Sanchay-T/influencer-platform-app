import { isAdminUser } from '@/lib/auth/admin-utils';
import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { LogCategory } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { approveSubmission } from '@/lib/services/social-sharing';
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
	const submissionId = typeof body === 'object' && body !== null && 'submissionId' in body
		? String(body.submissionId)
		: '';

	if (!submissionId) {
		return createErrorResponse('submissionId is required', 400, requestId);
	}

	logPhase('business');

	try {
		const result = await approveSubmission({
			submissionId,
			adminInternalId: adminProfile.id,
		});

		log.info('Social sharing submission approved via API', {
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
			err.message.includes('Cannot') ||
			err.message.includes('cannot')
		) {
			return createErrorResponse(err.message, 400, requestId);
		}

		log.error('Failed to approve submission', err, { requestId }, LogCategory.ADMIN);
		return createErrorResponse('Failed to approve submission', 500, requestId);
	}
}, LogCategory.ADMIN);
