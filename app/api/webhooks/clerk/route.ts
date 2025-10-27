import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { getUserProfile, createUser, updateUserProfile } from '@/lib/db/queries/user-queries';
import BillingLogger from '@/lib/loggers/billing-logger';

// Clerk webhook event types
type WebhookEvent = {
  id: string;
  object: 'event';
  type: string;
  data: any;
  timestamp: number;
};

export async function POST(req: NextRequest) {
  const requestId = BillingLogger.generateRequestId();
  
  try {
    await BillingLogger.logAPI(
      'REQUEST_START', 
      'Clerk webhook received',
      undefined,
      {
        endpoint: '/api/webhooks/clerk',
        method: 'POST',
        requestId
      },
      requestId
    );

    // Get the headers (await for Next.js 15 compatibility)
    const headerPayload = await headers();
    const svixId = headerPayload.get('svix-id');
    const svixTimestamp = headerPayload.get('svix-timestamp');
    const svixSignature = headerPayload.get('svix-signature');

    // If there are no headers, error out
    if (!svixId || !svixTimestamp || !svixSignature) {
      await BillingLogger.logAPI(
        'REQUEST_ERROR',
        'Missing Clerk webhook headers',
        undefined,
        {
          error: 'MISSING_HEADERS',
          svixId: !!svixId,
          svixTimestamp: !!svixTimestamp,
          svixSignature: !!svixSignature,
          requestId
        },
        requestId
      );
      return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
    }

    // Get the body
    const payload = await req.text();
    const body = JSON.parse(payload);

    // Create a new Svix instance with your webhook secret
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

    let evt: WebhookEvent;

    // Verify the payload with the headers
    try {
      evt = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as WebhookEvent;

      await BillingLogger.logAPI(
        'REQUEST_SUCCESS',
        'Clerk webhook signature verified',
        undefined,
        {
          eventType: evt.type,
          eventId: evt.id,
          requestId
        },
        requestId
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signature verification failed';
      
      await BillingLogger.logAPI(
        'REQUEST_ERROR',
        'Clerk webhook signature verification failed',
        undefined,
        {
          error: errorMessage,
          requestId
        },
        requestId
      );
      
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const { type, data } = evt;

    await BillingLogger.logAPI(
      'RESPONSE',
      `Processing Clerk webhook event: ${type}`,
      data?.id,
      {
        eventType: type,
        eventId: evt.id,
        userId: data?.id,
        requestId
      },
      requestId
    );

    // Handle the webhook
    switch (type) {
      case 'user.created':
        await handleUserCreated(data, requestId);
        break;
      
      case 'user.updated':
        await handleUserUpdated(data, requestId);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(data, requestId);
        break;
      
      default:
        await BillingLogger.logAPI(
          'RESPONSE',
          `Unhandled Clerk webhook event: ${type}`,
          data?.id,
          {
            eventType: type,
            handled: false,
            requestId
          },
          requestId
        );
        console.log(`🔔 [CLERK-WEBHOOK] Unhandled event type: ${type}`);
        break;
    }

    await BillingLogger.logAPI(
      'REQUEST_SUCCESS',
      'Clerk webhook processed successfully',
      data?.id,
      {
        eventType: type,
        eventId: evt.id,
        requestId
      },
      requestId
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown webhook processing error';
    
    await BillingLogger.logError(
      'CLERK_WEBHOOK_ERROR',
      'Clerk webhook processing failed',
      undefined,
      {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        requestId
      },
      requestId
    );

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ========================================================================================
// WEBHOOK EVENT HANDLERS
// ========================================================================================

/**
 * Handle user creation - Create user profile with free plan
 */
async function handleUserCreated(userData: any, requestId: string) {
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  const firstName = userData.first_name;
  const lastName = userData.last_name;
  const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'New User';

  await BillingLogger.logDatabase(
    'CREATE',
    'Creating new user profile after Clerk user creation',
    userId,
    {
      table: 'userProfiles',
      operation: 'user_created_webhook',
      email,
      fullName
    },
    requestId
  );

  try {
    // Check if user profile already exists (safety check)
    const existingProfile = await getUserProfile(userId);

    if (existingProfile) {
      await BillingLogger.logDatabase(
        'READ',
        'User profile already exists - skipping creation',
        userId,
        {
          table: 'userProfiles',
          existingProfile: !!existingProfile,
          currentPlan: existingProfile.currentPlan
        },
        requestId
      );
      return;
    }

    // Create new user profile with normalized tables
    // DO NOT activate trial here - trial activates AFTER payment in onboarding Step 4
    await createUser({
      userId: userId,
      email: email,
      fullName: fullName,
      onboardingStep: 'pending', // Will trigger onboarding modal

      // NO TRIAL DATA - trial will be activated after payment
      // trialStartDate: undefined,
      // trialEndDate: undefined,

      // Subscription defaults
      currentPlan: 'free', // Start with free, upgrade during onboarding
    });

    await BillingLogger.logDatabase(
      'CREATE',
      'User profile created successfully',
      userId,
      {
        table: 'userProfiles',
        recordId: userId,
        currentPlan: 'free',
        trialStatus: 'pending', // Trial NOT activated yet
        onboardingStep: 'pending',
        note: 'Trial will activate after payment in onboarding Step 4'
      },
      requestId
    );

    await BillingLogger.logPlanChange(
      'UPGRADE',
      'New user created - trial will activate after payment',
      userId,
      {
        fromPlan: undefined,
        toPlan: 'free',
        reason: 'user_created',
        billingCycle: 'none', // No trial yet
        effective: new Date().toISOString()
      },
      requestId
    );

    console.log(`✅ [CLERK-WEBHOOK] User profile created for ${userId} (trial pending payment)`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Database error';
    
    await BillingLogger.logError(
      'USER_CREATION_ERROR',
      'Failed to create user profile',
      userId,
      {
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        email,
        fullName
      },
      requestId
    );

    console.error(`❌ [CLERK-WEBHOOK] Error creating user profile for ${userId}:`, error);
    throw error;
  }
}

/**
 * Handle user updates - Update email, name, etc.
 */
async function handleUserUpdated(userData: any, requestId: string) {
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  const firstName = userData.first_name;
  const lastName = userData.last_name;
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();

  try {
    await BillingLogger.logDatabase(
      'UPDATE',
      'Updating user profile after Clerk user update',
      userId,
      {
        table: 'userProfiles',
        operation: 'user_updated_webhook',
        email,
        fullName
      },
      requestId
    );

    // Update user profile
    const updateData: any = {};

    if (email) updateData.email = email;
    if (fullName) updateData.fullName = fullName;

    await updateUserProfile(userId, updateData);

    await BillingLogger.logDatabase(
      'UPDATE',
      'User profile updated successfully',
      userId,
      {
        table: 'userProfiles',
        changes: Object.keys(updateData),
        email,
        fullName
      },
      requestId
    );

    console.log(`✅ [CLERK-WEBHOOK] User profile updated for ${userId}`);

  } catch (error) {
    await BillingLogger.logError(
      'USER_UPDATE_ERROR',
      'Failed to update user profile',
      userId,
      {
        errorMessage: error instanceof Error ? error.message : 'Database error',
        email,
        fullName
      },
      requestId
    );

    console.error(`❌ [CLERK-WEBHOOK] Error updating user profile for ${userId}:`, error);
    throw error;
  }
}

/**
 * Handle user deletion - Clean up user data
 */
async function handleUserDeleted(userData: any, requestId: string) {
  const userId = userData.id;

  try {
    await BillingLogger.logDatabase(
      'DELETE',
      'Deleting user profile after Clerk user deletion',
      userId,
      {
        table: 'userProfiles',
        operation: 'user_deleted_webhook'
      },
      requestId
    );

    // For user deletion, we need to use the raw database operations as we don't have a delete function
    // This is intentionally limited since user deletion should be rare
    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    
    // Delete user (cascade will handle related tables)
    await db.delete(users).where(eq(users.userId, userId));

    await BillingLogger.logDatabase(
      'DELETE',
      'User profile deleted successfully',
      userId,
      {
        table: 'userProfiles',
        recordId: userId
      },
      requestId
    );

    await BillingLogger.logPlanChange(
      'CANCEL',
      'User account deleted - profile removed',
      userId,
      {
        reason: 'user_deleted'
      },
      requestId
    );

    console.log(`✅ [CLERK-WEBHOOK] User profile deleted for ${userId}`);

  } catch (error) {
    await BillingLogger.logError(
      'USER_DELETE_ERROR',
      'Failed to delete user profile',
      userId,
      {
        errorMessage: error instanceof Error ? error.message : 'Database error'
      },
      requestId
    );

    console.error(`❌ [CLERK-WEBHOOK] Error deleting user profile for ${userId}:`, error);
    throw error;
  }
}