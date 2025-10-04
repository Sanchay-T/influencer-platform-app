import { NextResponse } from 'next/server';
import { isAdminUser } from '@/lib/auth/admin-utils';
import { db } from '@/lib/db';
import { getUserProfile, updateUserProfile, createUser } from '@/lib/db/queries/user-queries';
import { logger, LogCategory } from '@/lib/logging';
import { withApiLogging, logDbOperation, createApiResponse, createErrorResponse } from '@/lib/middleware/api-logger';

export const POST = withApiLogging(async (req: Request, { requestId, logPhase, logger: log }) => {
  logPhase('auth');
  
  try {
    const isAdmin = await isAdminUser();
    if (!isAdmin) {
      log.warn('Admin API unauthorized access attempt', { requestId }, LogCategory.ADMIN);
      return createErrorResponse('Unauthorized', 401, requestId);
    }

    logPhase('validation');
    const { userId } = await req.json();
    if (!userId) {
      log.warn('Admin API validation failed', { 
        requestId, 
        reason: 'missing_user_id' 
      }, LogCategory.ADMIN);
      return createErrorResponse('User ID required', 400, requestId);
    }

    log.info('Admin API promoting user to admin', {
      requestId,
      targetUserId: userId
    }, LogCategory.ADMIN);

    logPhase('database');

    // Find or create user profile
    const existing = await logDbOperation('find_user_profile', async () => {
      return await getUserProfile(userId);
    }, { requestId });

    if (existing) {
      await logDbOperation('update_user_admin_status', async () => {
        return await updateUserProfile(userId, { isAdmin: true });
      }, { requestId });
      
      log.info('Admin API user updated to admin', {
        requestId,
        targetUserId: userId,
        operation: 'update_existing'
      }, LogCategory.ADMIN);
    } else {
      await logDbOperation('create_admin_user_profile', async () => {
        return await createUser({
          userId,
          isAdmin: true,
          onboardingStep: 'pending'
        });
      }, { requestId });
      
      log.info('Admin API user profile created as admin', {
        requestId,
        targetUserId: userId,
        operation: 'create_new'
      }, LogCategory.ADMIN);
    }

    return createApiResponse({ 
      success: true, 
      message: 'User promoted to admin' 
    }, 200, requestId);
  } catch (error) {
    log.error('Admin API promote user failed', error as Error, { 
      requestId,
      operation: 'promote_user'
    }, LogCategory.ADMIN);
    return createErrorResponse('Failed to promote user', 500, requestId);
  }
}, LogCategory.ADMIN);