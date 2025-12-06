---
description: Quick setup of test user with active subscription
argument-hint: <email> [plan]
allowed-tools: Bash(node:*/complete-onboarding*.js*), Bash(node:*/inspect-user*.js*)
---

# Setup Test User

Quickly set up a complete test user with active subscription. Perfect for testing features without manual onboarding.

## Arguments

- `$1`: **[Required]** Email for test user
- `$2`: **[Optional]** Plan name (defaults to "starter")

## Execution

This command runs multiple scripts in sequence:

1. Complete onboarding and activate plan:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/complete-onboarding-and-activate-plan.js "$1" "${2:-starter}"
```

2. Verify setup:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/inspect-user-state.js "$1"
```

## Output Analysis

Report:

1. **User Creation**: Confirm user exists or was created
2. **Onboarding**: All steps marked complete
3. **Subscription**: Plan activated and verified
4. **Ready Status**: User ready for testing

## Example Usage

```
/user/setup-test test@example.com
/user/setup-test demo@example.com pro
```

## What This Does

- Completes all onboarding steps
- Activates specified subscription plan
- Sets up default campaign/list (optional)
- Verifies everything is ready

## Use Cases

- Creating demo accounts
- Setting up test users
- QA environment preparation
- Developer onboarding

## Related Commands

- `/user/activate <email> <plan>` - Just activate plan
- `/user/reset <email>` - Reset test user
- `/user/inspect <email>` - Check user state
