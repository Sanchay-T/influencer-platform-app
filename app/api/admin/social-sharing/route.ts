import { isAdminUser } from '@/lib/auth/admin-utils';
import type { SocialSharingStatus } from '@/lib/db/schema';
import { LogCategory } from '@/lib/logging';
import {
	createApiResponse,
	createErrorResponse,
	withApiLogging,
} from '@/lib/middleware/api-logger';
import { listSubmissions } from '@/lib/services/social-sharing';
import { toError } from '@/lib/utils/type-guards';

const VALID_STATUSES: SocialSharingStatus[] = ['pending', 'approved', 'rejected'];

export const GET = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
	logPhase('auth');

	const isAdmin = await isAdminUser();
	if (!isAdmin) {
		log.warn('Admin API unauthorized access attempt', { requestId }, LogCategory.ADMIN);
		return createErrorResponse('Unauthorized', 401, requestId);
	}

	logPhase('validation');

	const url = new URL(req.url);
	const statusParam = url.searchParams.get('status');
	const emailSearch = url.searchParams.get('email') || undefined;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));

	// Validate status filter
	let status: SocialSharingStatus | undefined;
	if (statusParam) {
		const validStatus = VALID_STATUSES.find((s) => s === statusParam);
		if (!validStatus) {
			return createErrorResponse(
				`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
				400,
				requestId
			);
		}
		status = validStatus;
	}

	logPhase('database');

	try {
		const result = await listSubmissions({ status, emailSearch, page, pageSize });
		return createApiResponse(result, 200, requestId);
	} catch (error) {
		log.error('Failed to list submissions', toError(error), { requestId }, LogCategory.ADMIN);
		return createErrorResponse('Failed to list submissions', 500, requestId);
	}
}, LogCategory.ADMIN);
