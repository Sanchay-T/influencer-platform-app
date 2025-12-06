---
description: Inspect user state and debug user-related issues
argument-hint: <email>
allowed-tools: Bash(node:*/inspect-user*.js*), Read
---

# Inspect User State

Get detailed information about a user's current state including onboarding status, billing, campaigns, and subscriptions. Essential for debugging user issues.

## Arguments

- `$1`: **[Required]** User email address

## Execution

Run the inspection script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/inspect-user-state.js "$1"
```

## Output Analysis

Parse the output and extract:

1. **User Identity**:
   - User ID
   - Email
   - Name
   - Account creation date

2. **Onboarding Status**:
   - Current onboarding step
   - Completed steps
   - Onboarding completion status

3. **Subscription & Billing**:
   - Current plan
   - Subscription status (active/trial/canceled)
   - Trial expiration date
   - Stripe customer ID
   - Next billing date

4. **Usage Data**:
   - Number of campaigns
   - Number of lists
   - Search history count
   - Recent activity

5. **Issues Detected**:
   - Billing sync issues
   - Incomplete onboarding
   - Data inconsistencies
   - Account problems

## Example Usage

```
/user/inspect sanchay@example.com
```

## What This Tells You

Use this command when:
- User reports issues with their account
- Debugging subscription/billing problems
- Verifying onboarding completion
- Checking user data before reset/deletion
- Investigating trial expiration issues

## Related Commands

- `/user/reset <email>` - Reset user if issues found
- `/user/fix-billing <email>` - Fix billing sync issues
- `/db/list-users` - List all users in system
