# Clerk Webhook Setup Instructions

## 🚨 CRITICAL: Complete these steps to fix user profile creation

### Step 1: Add Environment Variable

Add this to your `.env.local` file:

```bash
# Clerk Webhook Secret (get this from Clerk Dashboard)
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Step 2: Set up Clerk Webhook in Dashboard

1. **Go to Clerk Dashboard** → Your App → Webhooks
2. **Click "Add Endpoint"**
3. **Set Endpoint URL**: `https://your-domain.com/api/webhooks/clerk`
   - For development: Use ngrok or similar tunneling service
   - For production: Use your actual domain
4. **Subscribe to Events**:
   - ✅ `user.created` (REQUIRED)
   - ✅ `user.updated` (Recommended)
   - ✅ `user.deleted` (Recommended)
5. **Copy the Webhook Secret** and add to `.env.local`

### Step 3: Development Setup (Local Testing)

For local development, you'll need to expose your localhost:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3000

# Use the ngrok URL in Clerk webhook settings
# Example: https://abc123.ngrok.io/api/webhooks/clerk
```

### Step 4: Test the Fix

1. **Delete your user row** from the database (as you did)
2. **Start your development server**
3. **Sign in with Clerk**
4. **The webhook should automatically create a user profile**

### Step 5: Verification

Check the logs - you should see:
```
✅ [CLERK-WEBHOOK] User profile created for user_xyz with 7-day trial
```

Instead of:
```
❌ [BILLING-STATUS] User profile not found
```

## What This Fixes

- ✅ **Automatic user profile creation** when users sign up
- ✅ **7-day trial starts immediately** 
- ✅ **Onboarding modal triggers** properly
- ✅ **Billing status API works** from day 1
- ✅ **No more 404 errors** for new users

## Fallback Protection

Even if the webhook fails, the billing status API now has a **fallback** that will create a default user profile automatically.

## Next Steps

Once this is working:
1. Test user signup flow
2. Verify onboarding works
3. Test plan selection
4. Verify billing status displays correctly