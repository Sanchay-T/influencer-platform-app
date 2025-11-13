---
description: Analyze database performance and generate insights
argument-hint:
allowed-tools: Bash(node:*/analyze-database*.js*), Bash(node:*/analyze-billing*.js*)
---

# Analyze Database

Perform comprehensive database analysis including performance metrics, data integrity checks, and usage statistics.

## Arguments

None required. Performs full database analysis.

## Execution

Run the analysis script:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/analyze-database.js
```

## Output Analysis

Parse and report:

1. **Performance Metrics**:
   - Query performance
   - Slow queries identified
   - Index usage statistics
   - Connection pool status

2. **Data Statistics**:
   - Total users
   - Active subscriptions
   - Campaigns created
   - Search volume
   - Storage usage

3. **Data Integrity**:
   - Orphaned records
   - Missing foreign keys
   - Duplicate entries
   - Inconsistent states

4. **Optimization Recommendations**:
   - Missing indexes
   - Query improvements
   - Schema optimizations
   - Cleanup opportunities

5. **Growth Trends**:
   - User growth rate
   - Usage patterns
   - Popular features
   - Resource utilization

## Example Usage

```
/db/analyze
```

## When To Use

- Investigating performance issues
- Before production deployment
- Monthly health checks
- After major migrations
- Capacity planning
- Debugging data inconsistencies

## Analysis Areas

- **Users**: Account status, activity levels
- **Subscriptions**: Active/trial/canceled breakdown
- **Campaigns**: Creation rates, completion status
- **Searches**: Platform distribution, keyword trends
- **Billing**: Revenue metrics, churn analysis
- **Performance**: Query times, bottlenecks

## Common Findings

### Finding 1: Slow Queries
**Action**: Review suggested indexes or query optimizations

### Finding 2: Orphaned Data
**Action**: Run cleanup scripts for identified records

### Finding 3: Capacity Issues
**Action**: Review scaling recommendations

## Related Commands

- `/db/inspect` - Detailed database inspection
- `/db/list-users` - View all users
- `/logs/api` - Check API performance logs
