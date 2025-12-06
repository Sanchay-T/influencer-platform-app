---
description: List all users with their subscription and status info
argument-hint: [filter]
allowed-tools: Bash(node:*/list-users*.js*)
---

# List Database Users

Display all users in the database with their current status, subscription, and activity information.

## Arguments

- `$1`: **[Optional]** Filter (active/trial/subscribed/all) - defaults to "all"

## Execution

Run the list script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/list-users.js ${1:-all}
```

## Output Analysis

Parse and present:

1. **User List**:
   - Email address
   - User ID
   - Name
   - Account status

2. **Subscription Info**:
   - Current plan
   - Subscription status
   - Trial/paid indicator
   - Expiration dates

3. **Activity Metrics**:
   - Last login
   - Campaigns created
   - Searches performed
   - Account age

4. **Summary Statistics**:
   - Total users
   - Active users
   - Trial users
   - Paid subscribers
   - Inactive accounts

## Example Usage

```
/db/list-users
/db/list-users active
/db/list-users trial
/db/list-users subscribed
```

## Filter Options

- **all**: All users regardless of status
- **active**: Users with active subscriptions
- **trial**: Users on trial period
- **subscribed**: Paying subscribers only
- **inactive**: Users without recent activity

## Output Format

Display as formatted table:
```
Email                  | User ID      | Plan     | Status  | Created
--------------------- | ------------ | -------- | ------- | ----------
user@example.com      | usr_123      | starter  | active  | 2024-01-15
test@example.com      | usr_456      | pro      | trial   | 2024-02-01
```

## When To Use

- User audits
- Finding test accounts
- Subscription reviews
- Cleanup planning
- Usage analysis
- Support investigations

## Related Commands

- `/user/inspect <email>` - Detailed user information
- `/user/find <email>` - Search for specific user
- `/db/analyze` - Database-wide analytics
