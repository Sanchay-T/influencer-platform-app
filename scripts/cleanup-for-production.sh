#!/bin/bash

# 🧹 PRODUCTION CLEANUP SCRIPT
# Removes all test infrastructure and prepares for production deployment

echo "🧹 Starting production cleanup..."

# Remove test infrastructure files
echo "📁 Removing test files..."
rm -rf lib/test-utils/
rm -rf app/api/test/
rm -f app/test/page.tsx
rm -f scripts/test-subscription-*.js

# Keep this cleanup script for reference
echo "📝 Keeping cleanup script for reference..."

# Database cleanup (manual step - requires database connection)
echo "🗄️ DATABASE CLEANUP REQUIRED:"
echo "Run these SQL commands in your production database:"
echo ""
echo "DELETE FROM campaigns WHERE user_id LIKE 'test_%';"
echo "DELETE FROM user_profiles WHERE user_id LIKE 'test_%';"
echo ""

# Environment check
echo "⚙️ ENVIRONMENT VARIABLES TO UPDATE:"
echo "- DATABASE_URL: Switch from local to production database"
echo "- STRIPE_*: Switch from test to live Stripe keys"
echo "- All other environment variables can remain the same"
echo ""

# Verification steps
echo "✅ VERIFICATION STEPS:"
echo "1. Start your application: npm run dev (or production command)"
echo "2. Check logs for any 'test_' user references"
echo "3. Verify /test route returns 404"
echo "4. Verify /api/test routes return 404"
echo "5. Test user signup creates profile correctly"
echo "6. Test plan limits work for real users"
echo ""

echo "🚀 Production cleanup complete!"
echo "📖 See PRODUCTION_IMPLEMENTATION_GUIDE.md for deployment steps"