import { getAuthOrTest } from '@/lib/auth/get-auth-or-test';
import { getUserProfile } from '@/lib/db/queries/user-queries';
import { LogCategory } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { submitImage, submitLink } from '@/lib/services/social-sharing';
import { toError } from '@/lib/utils/type-guards';

export const POST = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
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

	logPhase('validation');

	const contentType = req.headers.get('content-type') || '';

	try {
		if (contentType.includes('multipart/form-data')) {
			// Image upload
			const formData = await req.formData();
			const file = formData.get('file');

			if (!file || !(file instanceof File)) {
				return createErrorResponse('No file provided', 400, requestId);
			}

			logPhase('business');
			const submission = await submitImage({
				userInternalId: profile.id,
				file,
			});

			return createApiResponse(
				{ success: true, submission: { id: submission.id, status: submission.status } },
				201,
				requestId
			);
		}

		// Link submission
		const body = await req.json();
		const url = typeof body === 'object' && body !== null && 'url' in body ? String(body.url) : '';

		if (!url) {
			return createErrorResponse('URL is required', 400, requestId);
		}

		logPhase('business');
		const submission = await submitLink({
			userInternalId: profile.id,
			url,
		});

		return createApiResponse(
			{ success: true, submission: { id: submission.id, status: submission.status } },
			201,
			requestId
		);
	} catch (error) {
		const err = toError(error);
		// Business logic errors (duplicate pending, invalid URL) → 400
		if (
			err.message.includes('already have a pending') ||
			err.message.includes('Invalid URL') ||
			err.message.includes('Invalid file type') ||
			err.message.includes('File too large')
		) {
			return createErrorResponse(err.message, 400, requestId);
		}

		log.error('Social sharing submission failed', err, { requestId }, LogCategory.API);
		return createErrorResponse('Failed to submit', 500, requestId);
	}
}, LogCategory.API);
