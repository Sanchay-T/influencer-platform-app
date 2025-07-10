/**
 * Mock Trial System - Ready for Stripe Integration
 * This demonstrates how trials will work once Stripe is connected
 */

export interface MockTrial {
  userId: string;
  trialStartDate: Date;
  trialEndDate: Date;
  status: 'active' | 'expired' | 'converted' | 'cancelled';
  daysRemaining: number;
  emailsScheduled: {
    day2: boolean;
    day5: boolean;
  };
}

/**
 * Calculate trial status for a user (mock implementation)
 */
export function calculateMockTrialStatus(signupDate: Date): MockTrial {
  const now = new Date();
  const trialStartDate = new Date(signupDate);
  const trialEndDate = new Date(trialStartDate);
  trialEndDate.setDate(trialEndDate.getDate() + 7); // 7-day trial
  
  const daysElapsed = Math.floor((now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 7 - daysElapsed);
  
  let status: MockTrial['status'] = 'active';
  if (daysRemaining === 0) {
    status = 'expired';
  }
  
  return {
    userId: 'mock-user',
    trialStartDate,
    trialEndDate,
    status,
    daysRemaining,
    emailsScheduled: {
      day2: daysElapsed >= 2,
      day5: daysElapsed >= 5
    }
  };
}

/**
 * Mock email scheduling for trials
 */
export function getMockEmailSchedule(trialStartDate: Date) {
  const schedules = [];
  
  // Welcome email (immediate)
  schedules.push({
    type: 'welcome',
    scheduledFor: new Date(trialStartDate.getTime() + 10 * 60 * 1000), // 10 minutes
    status: 'scheduled'
  });
  
  // Day 2 email
  const day2Date = new Date(trialStartDate);
  day2Date.setDate(day2Date.getDate() + 2);
  schedules.push({
    type: 'trial_day2',
    scheduledFor: day2Date,
    status: 'pending'
  });
  
  // Day 5 email
  const day5Date = new Date(trialStartDate);
  day5Date.setDate(day5Date.getDate() + 5);
  schedules.push({
    type: 'trial_day5',
    scheduledFor: day5Date,
    status: 'pending'
  });
  
  // Trial expiry notification (day 7)
  const expiryDate = new Date(trialStartDate);
  expiryDate.setDate(expiryDate.getDate() + 7);
  schedules.push({
    type: 'trial_expiry',
    scheduledFor: expiryDate,
    status: 'pending'
  });
  
  return schedules;
}

/**
 * Mock Stripe subscription data structure
 */
export interface MockStripeSubscription {
  id: string;
  customerId: string;
  subscriptionId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd: Date;
  cancelAtPeriodEnd: boolean;
  items: {
    priceId: string;
    quantity: number;
  }[];
}

/**
 * Generate mock Stripe subscription object
 */
export function generateMockSubscription(userId: string, trialStartDate: Date): MockStripeSubscription {
  const trialEndDate = new Date(trialStartDate);
  trialEndDate.setDate(trialEndDate.getDate() + 7);
  
  return {
    id: `sub_mock_${Date.now()}`,
    customerId: `cus_mock_${userId}`,
    subscriptionId: `sub_mock_${Date.now()}`,
    status: 'trialing',
    currentPeriodStart: trialStartDate,
    currentPeriodEnd: trialEndDate,
    trialEnd: trialEndDate,
    cancelAtPeriodEnd: false,
    items: [{
      priceId: 'price_mock_monthly_49',
      quantity: 1
    }]
  };
}

/**
 * Future Stripe integration points
 */
export const STRIPE_INTEGRATION_POINTS = {
  // Step 3 of onboarding
  checkoutSession: {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: 'price_xxx', // Your Stripe price ID
      quantity: 1
    }],
    subscription_data: {
      trial_period_days: 7
    },
    success_url: '/onboarding/complete?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: '/onboarding/complete'
  },
  
  // Webhook events to handle
  webhookEvents: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed'
  ],
  
  // Email triggers
  emailTriggers: {
    'customer.subscription.created': ['trial_day2', 'trial_day5'],
    'customer.subscription.deleted': ['cancellation_email'],
    'invoice.payment_failed': ['payment_failed_email']
  }
};