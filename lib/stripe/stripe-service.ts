import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Plan mapping for your actual Clerk plans
const PLAN_MAPPING = {
  'glow_up': {
    priceId: process.env.STRIPE_GLOW_UP_PRICE_ID!,
    amount: 9900, // $99.00
    name: 'Glow Up'
  },
  'viral_surge': {
    priceId: process.env.STRIPE_VIRAL_SURGE_PRICE_ID!,
    amount: 24900, // $249.00
    name: 'Viral Surge'
  },
  'fame_flex': {
    priceId: process.env.STRIPE_FAME_FLEX_PRICE_ID!,
    amount: 49900, // $499.00
    name: 'Fame Flex'
  }
};

export class StripeService {
  /**
   * Create a Stripe customer for the user
   */
  static async createCustomer(email: string, name: string, userId: string): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
          source: 'onboarding'
        }
      });
      
      console.log('✅ [STRIPE] Created customer:', customer.id);
      return customer;
    } catch (error) {
      console.error('❌ [STRIPE] Error creating customer:', error);
      throw error;
    }
  }

  /**
   * Create a Setup Intent for collecting payment method without immediate charge
   */
  static async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card'],
        metadata: {
          purpose: 'onboarding_card_collection'
        }
      });

      console.log('✅ [STRIPE] Created setup intent:', setupIntent.id);
      return setupIntent;
    } catch (error) {
      console.error('❌ [STRIPE] Error creating setup intent:', error);
      throw error;
    }
  }

  /**
   * Retrieve customer's saved payment methods
   */
  static async getCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      console.log(`✅ [STRIPE] Retrieved ${paymentMethods.data.length} payment methods for customer ${customerId}`);
      return paymentMethods.data;
    } catch (error) {
      console.error('❌ [STRIPE] Error retrieving payment methods:', error);
      throw error;
    }
  }

  /**
   * Set default payment method for customer
   */
  static async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      console.log('✅ [STRIPE] Set default payment method:', paymentMethodId);
      return customer;
    } catch (error) {
      console.error('❌ [STRIPE] Error setting default payment method:', error);
      throw error;
    }
  }

  /**
   * Create a subscription with trial period
   */
  static async createTrialSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<Stripe.Subscription> {
    try {
      const planConfig = PLAN_MAPPING[planId as keyof typeof PLAN_MAPPING];
      if (!planConfig) {
        throw new Error(`Invalid plan: ${planId}`);
      }

      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: planConfig.priceId }],
        trial_period_days: 7,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          plan: planId,
          source: 'onboarding'
        }
      };

      // Add payment method if provided
      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);
      console.log('✅ [STRIPE] Created trial subscription:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('❌ [STRIPE] Error creating trial subscription:', error);
      throw error;
    }
  }

  /**
   * Create immediate subscription (for upgrades)
   */
  static async createImmediateSubscription(
    customerId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<Stripe.Subscription> {
    try {
      const planConfig = PLAN_MAPPING[planId as keyof typeof PLAN_MAPPING];
      if (!planConfig) {
        throw new Error(`Invalid plan: ${planId}`);
      }

      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: planConfig.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          plan: planId,
          source: 'upgrade'
        }
      };

      // Add payment method if provided
      if (paymentMethodId) {
        subscriptionData.default_payment_method = paymentMethodId;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);
      console.log('✅ [STRIPE] Created immediate subscription:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('❌ [STRIPE] Error creating immediate subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription to new plan
   */
  static async updateSubscription(
    subscriptionId: string,
    newPlanId: string
  ): Promise<Stripe.Subscription> {
    try {
      const planConfig = PLAN_MAPPING[newPlanId as keyof typeof PLAN_MAPPING];
      if (!planConfig) {
        throw new Error(`Invalid plan: ${newPlanId}`);
      }

      // Get current subscription
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Update the subscription
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: planConfig.priceId
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          ...subscription.metadata,
          plan: newPlanId,
          upgraded_at: new Date().toISOString()
        }
      });

      console.log('✅ [STRIPE] Updated subscription:', subscriptionId);
      return updatedSubscription;
    } catch (error) {
      console.error('❌ [STRIPE] Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          cancelled_at: new Date().toISOString()
        }
      });

      console.log('✅ [STRIPE] Cancelled subscription:', subscriptionId);
      return subscription;
    } catch (error) {
      console.error('❌ [STRIPE] Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  static async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['customer', 'default_payment_method']
      });

      return subscription;
    } catch (error) {
      console.error('❌ [STRIPE] Error retrieving subscription:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent for one-time payments
   */
  static async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId: string,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount,
        currency,
        customer: customerId,
        setup_future_usage: 'off_session',
        metadata: {
          source: 'one_time_payment'
        }
      };

      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirmation_method = 'manual';
        paymentIntentData.confirm = true;
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
      console.log('✅ [STRIPE] Created payment intent:', paymentIntent.id);
      return paymentIntent;
    } catch (error) {
      console.error('❌ [STRIPE] Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(payload: string, signature: string): Stripe.Event {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      return event;
    } catch (error) {
      console.error('❌ [STRIPE] Webhook signature validation failed:', error);
      throw error;
    }
  }

  /**
   * Get plan configuration
   */
  static getPlanConfig(planId: string) {
    return PLAN_MAPPING[planId as keyof typeof PLAN_MAPPING];
  }

  /**
   * Get all plan configurations
   */
  static getAllPlanConfigs() {
    return PLAN_MAPPING;
  }
}

export default StripeService;