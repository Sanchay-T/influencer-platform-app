import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { LogCategory } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { getSubmissionStatus } from '@/lib/services/social-sharing';

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
	const result = await getSubmissionStatus(profile.id);
	return createApiResponse(result, 200, requestId);
}, LogCategory.API);
