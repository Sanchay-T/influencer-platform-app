---
description: Reset user onboarding state and data for fresh start
argument-hint: <email>
allowed-tools: Bash(node:*/reset-user*.js*), Bash(tsx:*/reset-user*.ts*)
---

# Reset User Onboarding

Reset a user's onboarding state and data to allow them to start fresh. This is useful when testing onboarding flows or debugging user issues.

## Arguments

- `$1`: **[Required]** User email address

## Execution

Run the reset script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/reset-user-onboarding.js "$1"
```

## Output Analysis

Parse the output and report:

1. **Success/Failure**: Did the reset complete successfully?
2. **What Was Reset**: List what data was cleared (campaigns, lists, onboarding state, etc.)
3. **User Status**: Current user state after reset
4. **Errors**: Any errors or warnings encountered
5. **Next Steps**: What the user can do now (e.g., "User can now complete onboarding from scratch")

## Example Usage

```
/user/reset sanchay@example.com
```

## Common Issues

### Issue 1: User Not Found
**Solution**: Verify the email address is correct. Use `/user/find <email>` to search for the user.

### Issue 2: Database Connection Error
**Solution**: Check that environment variables are set correctly. Run `/dev/check-env` to validate.

### Issue 3: Partial Reset
**Solution**: If reset partially fails, inspect user state with `/user/inspect <email>` to see what needs manual cleanup.

## Safety Notes

- This operation is destructive and cannot be undone
- All user campaigns, lists, and search history will be deleted
- User account and billing information are preserved
- Best used in development/testing environments
