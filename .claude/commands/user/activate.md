---
description: Complete onboarding and activate user subscription plan
argument-hint: <email> <plan>
allowed-tools: Bash(node:*/complete-onboarding*.js*)
---

# Activate User Plan

Complete user onboarding and activate a specific subscription plan. Useful for testing or manually setting up users.

## Arguments

- `$1`: **[Required]** User email address
- `$2`: **[Required]** Plan name (starter/growth/pro/fame-flex)

## Execution

Run the activation script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/complete-onboarding-and-activate-plan.js "$1" "$2"
```

## Output Analysis

Report:

1. **Onboarding Completion**:
   - Steps completed
   - Final onboarding status

2. **Plan Activation**:
   - Plan activated
   - Subscription created
   - Trial status
   - Billing cycle start

3. **User Access**:
   - Features enabled
   - Usage limits
   - Next billing date

4. **Verification**: Confirm user can access platform

## Example Usage

```
/user/activate sanchay@example.com starter
/user/activate test@example.com fame-flex
```

## Available Plans

- **starter**: Basic plan for new users
- **growth**: Mid-tier plan with more features
- **pro**: Advanced plan with full features
- **fame-flex**: Flexible enterprise plan

## When To Use

- Testing subscription flows
- Manual user setup for demos
- Recovering from onboarding errors
- Setting up test accounts
- Customer support escalations

## Pre-requisites

- User account must exist
- Valid email address
- Plan must exist in Stripe

## Related Commands

- `/user/inspect <email>` - Verify activation
- `/db/seed-plans` - Ensure plans exist in database
- `/test/subscription` - Test subscription system
- `/user/reset <email>` - Reset if activation fails
