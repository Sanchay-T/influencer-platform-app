---
description: Find user ID and basic info by email address
argument-hint: <email>
allowed-tools: Bash(node:*/find-user*.js*)
---

# Find User by Email

Quickly find a user's ID and basic information using their email address. Useful for getting user IDs for other operations.

## Arguments

- `$1`: **[Required]** User email address (can be partial)

## Execution

Run the find script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/find-user-id.js "$1"
```

## Output Analysis

Extract and display:

1. **User ID**: The database ID for the user
2. **Email**: Full email address
3. **Name**: User's display name
4. **Status**: Account status (active/inactive)
5. **Created**: When account was created

If multiple users match (partial email), list all matches.

## Example Usage

```
/user/find sanchay@example.com
/user/find @gmail.com
```

## Use Cases

- Get user ID for API testing
- Find users by domain
- Verify user exists before operations
- Look up test accounts

## Related Commands

- `/user/inspect <email>` - Get detailed user information
- `/db/list-users` - List all users in database
