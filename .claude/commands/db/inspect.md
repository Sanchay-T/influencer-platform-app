---
description: Inspect database schema and current state
argument-hint: [table]
allowed-tools: Bash(node:*/inspect-db*.js*), Bash(node:*/baseline-drizzle-supabase*.js*)
---

# Inspect Database

Inspect database schema, tables, and current state. View table structures, relationships, and data counts.

## Arguments

- `$1`: **[Optional]** Specific table name to inspect (inspects all if not provided)

## Execution

Run the inspection script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/inspect-db.js ${1:-}
```

## Output Analysis

Report:

1. **Schema Overview**:
   - Database name and version
   - Total tables
   - Total records across tables
   - Schema health status

2. **Table Information**:
   - Table names
   - Column definitions
   - Data types
   - Constraints and indexes
   - Foreign key relationships

3. **Data Counts**:
   - Records per table
   - Empty tables
   - Large tables requiring attention

4. **Schema Issues**:
   - Missing indexes
   - Orphaned tables
   - Deprecated columns
   - Migration status

## Example Usage

```
/db/inspect
/db/inspect users
/db/inspect subscriptions
```

## Key Tables

- **users**: User accounts and profiles
- **subscriptions**: Subscription and billing data
- **campaigns**: User campaigns
- **lists**: Creator lists
- **searches**: Search history and results
- **subscription_plans**: Available plans

## When To Use

- Understanding database structure
- Before schema changes
- Debugging data issues
- Migration planning
- Documentation updates
- New developer onboarding

## Detailed Inspection

For specific table, shows:
- All columns with types
- Indexes and their usage
- Foreign key relationships
- Sample data (first few rows)
- Record count and storage size

## Related Commands

- `/db/analyze` - Performance analysis
- `/db/list-users` - List users table
- `/user/inspect <email>` - Inspect specific user data
