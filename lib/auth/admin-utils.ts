import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Unified admin authentication function
 * Checks both environment variable and database admin status
 */
export async function isAdminUser(): Promise<boolean> {
  try {
    console.log('🔍 [ADMIN-CHECK] Starting admin authentication check');
    
    // Get authenticated user
    const { userId } = await auth();
    console.log('🔍 [ADMIN-CHECK] User ID from auth:', userId);
    if (!userId) {
      console.log('❌ [ADMIN-CHECK] No user ID found');
      return false;
    }

    // Get user from Clerk to access email
    console.log('🔍 [ADMIN-CHECK] Getting user from Clerk...');
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userEmail = user.primaryEmailAddress?.emailAddress;
    
    console.log('🔍 [ADMIN-CHECK] User email retrieved:', userEmail);
    if (!userEmail) {
      console.log('❌ [ADMIN-CHECK] No email found for user');
      return false;
    }

    // Method 1: Check environment variable (primary method)
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
    console.log('🔍 [ADMIN-CHECK] Admin emails from env:', adminEmails);
    const isEnvAdmin = adminEmails.includes(userEmail);
    
    if (isEnvAdmin) {
      console.log('✅ [ADMIN-CHECK] User is admin via environment variable:', userEmail);
      return true;
    }

    // Method 2: Check database admin status (future feature)
    try {
      const userProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
        columns: { isAdmin: true }
      });

      console.log('🔍 [ADMIN-CHECK] Database admin check result:', userProfile?.isAdmin);
      if (userProfile?.isAdmin) {
        console.log('✅ [ADMIN-CHECK] User is admin via database:', userEmail);
        return true;
      }
    } catch (dbError) {
      console.warn('⚠️ [ADMIN-CHECK] Database admin check failed (field may not exist yet):', dbError);
      // Continue with env-only check for now
    }

    console.log('❌ [ADMIN-CHECK] User is not admin:', userEmail);
    console.log('🔍 [ADMIN-CHECK] Admin check failed - user email not in admin list and not database admin');
    return false;

  } catch (error) {
    console.error('❌ [ADMIN-CHECK] Error checking admin status:', error);
    return false;
  }
}

/**
 * Get current user's admin status and details
 */
export async function getCurrentUserAdminInfo() {
  try {
    const { userId } = await auth();
    if (!userId) return { isAdmin: false, user: null };

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const isAdmin = await isAdminUser();

    return {
      isAdmin,
      user: {
        id: userId,
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      }
    };
  } catch (error) {
    console.error('❌ [ADMIN-INFO] Error getting admin info:', error);
    return { isAdmin: false, user: null };
  }
}

/**
 * Promote a user to admin status (database method)
 */
export async function promoteUserToAdmin(targetUserId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if current user is admin
    const currentUserAdmin = await isAdminUser();
    if (!currentUserAdmin) {
      return { success: false, message: 'Unauthorized: Only admins can promote users' };
    }

    // Update user's admin status in database
    await db.update(userProfiles)
      .set({ 
        isAdmin: true,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, targetUserId));

    console.log('✅ [ADMIN-PROMOTION] User promoted to admin:', targetUserId);
    return { success: true, message: 'User successfully promoted to admin' };

  } catch (error) {
    console.error('❌ [ADMIN-PROMOTION] Error promoting user:', error);
    return { success: false, message: 'Failed to promote user to admin' };
  }
}

/**
 * Demote a user from admin status (database method)
 */
export async function demoteUserFromAdmin(targetUserId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if current user is admin
    const currentUserAdmin = await isAdminUser();
    if (!currentUserAdmin) {
      return { success: false, message: 'Unauthorized: Only admins can demote users' };
    }

    // Get current user info to prevent self-demotion
    const { userId: currentUserId } = await auth();
    if (currentUserId === targetUserId) {
      return { success: false, message: 'Cannot demote yourself from admin' };
    }

    // Update user's admin status in database
    await db.update(userProfiles)
      .set({ 
        isAdmin: false,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, targetUserId));

    console.log('✅ [ADMIN-DEMOTION] User demoted from admin:', targetUserId);
    return { success: true, message: 'User successfully demoted from admin' };

  } catch (error) {
    console.error('❌ [ADMIN-DEMOTION] Error demoting user:', error);
    return { success: false, message: 'Failed to demote user from admin' };
  }
}

/**
 * Get all admin users (environment + database)
 */
export async function getAllAdminUsers() {
  try {
    const result = {
      environmentAdmins: [] as string[],
      databaseAdmins: [] as any[],
      totalCount: 0
    };

    // Get environment admins
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
    result.environmentAdmins = adminEmails.filter(email => email.trim());

    // Get database admins (if field exists)
    try {
      const dbAdmins = await db.query.userProfiles.findMany({
        where: eq(userProfiles.isAdmin, true),
        columns: {
          userId: true,
          fullName: true,
          email: true,
          isAdmin: true,
          updatedAt: true
        }
      });
      result.databaseAdmins = dbAdmins;
    } catch (dbError) {
      console.warn('⚠️ [ADMIN-LIST] Database admin query failed (field may not exist yet)');
    }

    result.totalCount = result.environmentAdmins.length + result.databaseAdmins.length;
    return result;

  } catch (error) {
    console.error('❌ [ADMIN-LIST] Error getting admin list:', error);
    return { environmentAdmins: [], databaseAdmins: [], totalCount: 0 };
  }
}