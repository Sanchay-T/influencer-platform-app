import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { LogCategory } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { getUserLatestSubmission } from '@/lib/services/social-sharing';

export const GET = withApiLogging(async (_req: Request, { requestId, logPhase }) => {
	logPhase('auth');

	const { userId } = await getAuthOrTest();
	if (!userId) {
		return createErrorResponse('Unauthorized', 401, requestId);
	}

	// Resolve internal user ID
	const profile = await getUserProfile(userId);
	if (!profile) {
		return createErrorResponse('User profile not found', 404, requestId);
	}

	logPhase('database');
	const submission = await getUserLatestSubmission(profile.id);

	if (!submission) {
		return createApiResponse({ status: 'none', submission: null }, 200, requestId);
	}

	return createApiResponse(
		{
			status: submission.status,
			submission: {
				id: submission.id,
				evidenceType: submission.evidenceType,
				evidenceUrl: submission.evidenceUrl,
				status: submission.status,
				adminNotes: submission.adminNotes,
				createdAt: submission.createdAt,
			},
		},
		200,
		requestId
	);
}, LogCategory.API);
