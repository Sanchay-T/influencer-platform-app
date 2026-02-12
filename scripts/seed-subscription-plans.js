#!/usr/bin/env node

const { config } = require('dotenv');
const path = require('path');

// Load appropriate environment file
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env.local';
config({ path: path.resolve(process.cwd(), envFile) });

console.log(`🌱 Seeding subscription plans using ${envFile}...`);

async function seedPlans() {
  try {
    // Import database and schema
    const { db } = require('../lib/db/index.ts');
    const { subscriptionPlans } = require('../lib/db/schema.ts');

    console.log('🗄️ Connected to database');
    
    // Define the subscription plans based on requirements
    const plans = [
      {
        planKey: 'glow_up',
        displayName: 'Glow Up Plan',
        description: 'Perfect for growing creators and small businesses',
        monthlyPrice: 9900, // $99.00 in cents
        yearlyPrice: 9480, // $79/month * 12 = $948.00 in cents (20% discount)
        stripeMonthlyPriceId: process.env.STRIPE_GLOW_UP_MONTHLY_PRICE_ID,
        stripeYearlyPriceId: process.env.STRIPE_GLOW_UP_YEARLY_PRICE_ID,
        campaignsLimit: 3,
        creatorsLimit: 1000,
        features: {
          platforms: ['TikTok', 'Instagram', 'YouTube'],
          exportFormats: ['CSV'],
          emailExtraction: true,
          bioExtraction: true,
          support: 'email'
        },
        sortOrder: 1,
        isActive: true
      },
      {
        planKey: 'viral_surge',
        displayName: 'Viral Surge Plan', 
        description: 'For agencies and serious marketers',
        monthlyPrice: 24900, // $249.00 in cents
        yearlyPrice: 23880, // $199/month * 12 = $2,388.00 in cents (20% discount)
        stripeMonthlyPriceId: process.env.STRIPE_VIRAL_SURGE_MONTHLY_PRICE_ID,
        stripeYearlyPriceId: process.env.STRIPE_VIRAL_SURGE_YEARLY_PRICE_ID,
        campaignsLimit: 10,
        creatorsLimit: 10000,
        features: {
          platforms: ['TikTok', 'Instagram', 'YouTube'],
          exportFormats: ['CSV', 'Excel'],
          emailExtraction: true,
          bioExtraction: true,
          advancedFiltering: true,
          prioritySupport: true,
          support: 'priority'
        },
        sortOrder: 2,
        isActive: true
      },
      {
        planKey: 'fame_flex',
        displayName: 'Fame Flex Plan',
        description: 'Unlimited power for enterprise users',
        monthlyPrice: 49900, // $499.00 in cents
        yearlyPrice: 47880, // $399/month * 12 = $4,788.00 in cents (20% discount)
        stripeMonthlyPriceId: process.env.STRIPE_FAME_FLEX_MONTHLY_PRICE_ID,
        stripeYearlyPriceId: process.env.STRIPE_FAME_FLEX_YEARLY_PRICE_ID,
        campaignsLimit: -1, // -1 indicates unlimited
        creatorsLimit: -1, // -1 indicates unlimited  
        features: {
          platforms: ['TikTok', 'Instagram', 'YouTube'],
          exportFormats: ['CSV', 'Excel', 'JSON'],
          emailExtraction: true,
          bioExtraction: true,
          advancedFiltering: true,
          customIntegrations: true,
          dedicatedSupport: true,
          apiAccess: true,
          support: 'dedicated'
        },
        sortOrder: 3,
        isActive: true
      }
    ];

    console.log('🔄 Inserting subscription plans...');
    
    // Clear existing plans
    await db.delete(subscriptionPlans);
    console.log('🗑️ Cleared existing plans');

    // Insert new plans
    for (const plan of plans) {
      console.log(`📦 Creating plan: ${plan.displayName}`);
      
      const [insertedPlan] = await db.insert(subscriptionPlans)
        .values({
          ...plan,
          features: JSON.stringify(plan.features)
        })
        .returning();
      
      console.log(`✅ Created plan: ${insertedPlan.planKey} (${insertedPlan.displayName})`);
    }

    console.log('');
    console.log('🎉 Subscription plans seeded successfully!');
    console.log('');
    console.log('📋 Plans created:');
    
    // Fetch and display created plans
    const createdPlans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder);
    
    for (const plan of createdPlans) {
      console.log(`  • ${plan.displayName} (${plan.planKey})`);
      console.log(`    Monthly: $${plan.monthlyPrice / 100}, Yearly: $${plan.yearlyPrice / 100}`);
      console.log(`    Limits: ${plan.campaignsLimit === -1 ? 'Unlimited' : plan.campaignsLimit} campaigns, ${plan.creatorsLimit === -1 ? 'Unlimited' : plan.creatorsLimit.toLocaleString()} creators`);
      console.log('');
    }

    console.log('💡 Next steps:');
    console.log('   • Test plan validation: npm run db:local:test');
    console.log('   • View in database studio: npm run db:studio:local');
    console.log('   • Start development server: npm run dev:ngrok');

  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   • Make sure database is running: docker-compose ps');
    console.log('   • Run migrations first: NODE_ENV=development npm run db:push');
    console.log('   • Check Stripe environment variables are set');
    process.exit(1);
  }
}

seedPlans();
