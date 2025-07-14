import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  // Verify the webhook
  const WEBHOOK_SECRET = process.env.CLERK_BILLING_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_BILLING_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.text();
  const body = JSON.parse(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  console.log('🔔 [CLERK-BILLING-WEBHOOK] Received event:', {
    type: evt.type,
    userId: evt.data?.user_id,
    subscriptionId: evt.data?.subscription?.id,
    planId: evt.data?.subscription?.plan?.id
  });

  try {
    switch (evt.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(evt.data);
        break;
      
      case 'subscription.updated':
        await handleSubscriptionUpdated(evt.data);
        break;
      
      case 'subscription.deleted':
        await handleSubscriptionDeleted(evt.data);
        break;
      
      case 'subscription.trial_will_end':
        await handleTrialWillEnd(evt.data);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(evt.data);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(evt.data);
        break;
      
      default:
        console.log(`🔕 [CLERK-BILLING-WEBHOOK] Unhandled event type: ${evt.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ [CLERK-BILLING-WEBHOOK] Error processing webhook:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(data: any) {
  console.log('📝 [CLERK-BILLING-WEBHOOK] Processing subscription.created');
  
  const userId = data.user_id;
  const subscription = data.subscription;
  
  if (!userId || !subscription) return;

  const planId = subscription.plan?.id;
  const currentPlan = mapClerkPlanToInternalPlan(planId);

  await updateUserBillingStatus(userId, {
    clerkSubscriptionId: subscription.id,
    currentPlan,
    subscriptionStatus: subscription.status === 'trialing' ? 'trialing' : 'active',
    trialStatus: subscription.status === 'trialing' ? 'active' : 'converted'
  });

  console.log('✅ [CLERK-BILLING-WEBHOOK] Subscription created processed:', {
    userId,
    subscriptionId: subscription.id,
    plan: currentPlan
  });
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(data: any) {
  console.log('📝 [CLERK-BILLING-WEBHOOK] Processing subscription.updated');
  
  const userId = data.user_id;
  const subscription = data.subscription;
  
  if (!userId || !subscription) return;

  const planId = subscription.plan?.id;
  const currentPlan = mapClerkPlanToInternalPlan(planId);

  await updateUserBillingStatus(userId, {
    clerkSubscriptionId: subscription.id,
    currentPlan,
    subscriptionStatus: subscription.status,
    trialStatus: subscription.status === 'trialing' ? 'active' : 'converted'
  });

  console.log('✅ [CLERK-BILLING-WEBHOOK] Subscription updated processed:', {
    userId,
    subscriptionId: subscription.id,
    plan: currentPlan,
    status: subscription.status
  });
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(data: any) {
  console.log('📝 [CLERK-BILLING-WEBHOOK] Processing subscription.deleted');
  
  const userId = data.user_id;
  const subscription = data.subscription;
  
  if (!userId) return;

  await updateUserBillingStatus(userId, {
    clerkSubscriptionId: null,
    currentPlan: 'free',
    subscriptionStatus: 'canceled',
    trialStatus: 'expired'
  });

  console.log('✅ [CLERK-BILLING-WEBHOOK] Subscription deleted processed:', {
    userId,
    subscriptionId: subscription?.id
  });
}

/**
 * Handle trial will end event
 */
async function handleTrialWillEnd(data: any) {
  console.log('📝 [CLERK-BILLING-WEBHOOK] Processing subscription.trial_will_end');
  
  const userId = data.user_id;
  const subscription = data.subscription;
  
  if (!userId) return;

  // You could send a notification email here
  console.log('⚠️ [CLERK-BILLING-WEBHOOK] Trial ending soon for user:', userId);
  
  // TODO: Send trial ending email notification
  // await sendTrialEndingEmail(userId);
}

/**
 * Handle successful payment event
 */
async function handlePaymentSucceeded(data: any) {
  console.log('📝 [CLERK-BILLING-WEBHOOK] Processing invoice.payment_succeeded');
  
  const userId = data.customer?.user_id;
  
  if (!userId) return;

  // Update subscription to active if it was past due
  await updateUserBillingStatus(userId, {
    subscriptionStatus: 'active'
  });

  console.log('✅ [CLERK-BILLING-WEBHOOK] Payment succeeded processed:', {
    userId,
    amount: data.amount_paid
  });
}

/**
 * Handle failed payment event
 */
async function handlePaymentFailed(data: any) {
  console.log('📝 [CLERK-BILLING-WEBHOOK] Processing invoice.payment_failed');
  
  const userId = data.customer?.user_id;
  
  if (!userId) return;

  // Update subscription to past due
  await updateUserBillingStatus(userId, {
    subscriptionStatus: 'past_due'
  });

  console.log('⚠️ [CLERK-BILLING-WEBHOOK] Payment failed processed:', {
    userId,
    amount: data.amount_due
  });
}

/**
 * Update user billing status in database
 */
async function updateUserBillingStatus(userId: string, updates: {
  clerkSubscriptionId?: string | null;
  currentPlan?: 'free' | 'premium' | 'enterprise';
  subscriptionStatus?: string;
  trialStatus?: string;
}) {
  try {
    await db.update(userProfiles)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(userProfiles.userId, userId));

    console.log('✅ [CLERK-BILLING-WEBHOOK] User billing status updated:', {
      userId,
      updates
    });
  } catch (error) {
    console.error('❌ [CLERK-BILLING-WEBHOOK] Error updating user billing status:', error);
    throw error;
  }
}

/**
 * Map Clerk plan IDs to internal plan names
 */
function mapClerkPlanToInternalPlan(clerkPlanId: string): 'free' | 'premium' | 'enterprise' {
  // Map your Clerk plan IDs to internal plan names
  const planMapping: Record<string, 'free' | 'premium' | 'enterprise'> = {
    'free': 'free',
    'premium': 'premium', 
    'enterprise': 'enterprise'
  };

  return planMapping[clerkPlanId] || 'free';
}