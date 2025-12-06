---
description: Completely delete user and all associated data
argument-hint: <email>
allowed-tools: Bash(node:*/delete-user*.js*)
---

# Delete User Completely

Permanently delete a user account and all associated data including campaigns, lists, search history, and billing information.

## Arguments

- `$1`: **[Required]** User email address

## Execution

Run the deletion script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/delete-user-completely.js "$1"
```

## Output Analysis

Report:

1. **Confirmation**: User identity being deleted
2. **Deleted Data**:
   - User account record
   - All campaigns
   - All lists
   - Search history
   - Billing records
   - Subscription data
3. **Success/Failure**: Whether deletion completed
4. **Errors**: Any errors encountered

## Example Usage

```
/user/delete test@example.com
```

## DANGER WARNINGS

- **IRREVERSIBLE**: This operation cannot be undone
- **PRODUCTION**: Use extreme caution in production
- **GDPR**: Use for GDPR deletion requests
- **BACKUP**: Consider backing up user data first

## Safety Checklist

Before deleting:
1. Verify correct user with `/user/inspect <email>`
2. Confirm with user if production account
3. Check for active subscriptions
4. Consider `/user/reset` as alternative for testing

## When To Use

- Cleaning up test accounts
- Processing GDPR deletion requests
- Removing duplicate accounts
- Development database cleanup

## Related Commands

- `/user/inspect <email>` - Check user before deleting
- `/user/reset <email>` - Alternative: reset instead of delete
- `/db/list-users` - Find users to clean up
