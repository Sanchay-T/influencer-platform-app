---
description: View and analyze API logs for debugging
argument-hint: [filter]
allowed-tools: Bash(node:*/view-api-logs*.js*), Bash(node:*/api-logger*.js*), Read
---

# View API Logs

View and analyze API request/response logs for debugging and monitoring. Shows recent API activity with filtering options.

## Arguments

- `$1`: **[Optional]** Filter by endpoint, status, or error (e.g., "error", "search", "500")

## Execution

View the API logs:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/view-api-logs.js ${1:-}
```

## Output Analysis

Parse and display:

1. **Log Summary**:
   - Total requests logged
   - Time range covered
   - Success vs error ratio
   - Average response time

2. **Recent Requests**:
   For each logged request:
   - Timestamp
   - HTTP method and endpoint
   - Status code
   - Response time
   - User/request ID
   - IP address

3. **Error Analysis**:
   For failed requests:
   - Error type
   - Error message
   - Stack trace
   - Request payload
   - Failed endpoint

4. **Performance Metrics**:
   - Slowest endpoints
   - Most called endpoints
   - Error rate by endpoint
   - Response time percentiles

5. **Patterns Detected**:
   - Repeated errors
   - Rate limiting hits
   - Authentication failures
   - Timeout issues

## Example Usage

```
/logs/api
/logs/api error
/logs/api search
/logs/api 500
/logs/api instagram
```

## Log Filters

### By Status:
- `error` - Only error responses (4xx, 5xx)
- `success` - Only successful responses (2xx)
- `500` - Specific status code

### By Endpoint:
- `search` - Search-related endpoints
- `user` - User-related endpoints
- `campaigns` - Campaign endpoints
- `webhooks` - Webhook endpoints

### By Issue Type:
- `slow` - Requests over 2 seconds
- `timeout` - Timed out requests
- `auth` - Authentication issues

## Log Entry Format

Each log entry shows:
```
[2024-01-15 10:30:45] POST /api/search/instagram-us-reels
Status: 200 OK
Response Time: 1.2s
User: user_123abc
Request: {"keyword": "fitness", "limit": 10}
Response: {"results": [...], "count": 10}
```

Error entries include:
```
[2024-01-15 10:35:12] POST /api/search/instagram-us-reels
Status: 500 Internal Server Error
Response Time: 0.5s
User: user_456def
Error: ApiError: Rate limit exceeded for Apify
Stack: at searchInstagram (/app/lib/search.ts:45)
       at POST (/app/api/search/instagram-us-reels/route.ts:23)
```

## Common Issues to Look For

### Issue 1: Repeated 500 Errors
**Indicates**: Backend bug or service outage
**Action**: Review error details and fix code

### Issue 2: High Response Times
**Indicates**: Performance issue or external API slowness
**Action**: Optimize queries or add caching

### Issue 3: 401/403 Errors
**Indicates**: Authentication or permission issues
**Action**: Check auth flow and user permissions

### Issue 4: Rate Limit Errors
**Indicates**: Too many requests to external APIs
**Action**: Implement rate limiting or increase limits

### Issue 5: Webhook Failures
**Indicates**: Webhook processing errors
**Action**: Use `/logs/diagnose-webhook` for details

## Log Levels

- **INFO**: Normal operation logs
- **WARN**: Non-critical issues
- **ERROR**: Error conditions
- **DEBUG**: Detailed debugging info

## Performance Analysis

Look for:
- Endpoints consistently slow (>2s)
- Spikes in error rates
- Unusual traffic patterns
- Failed external API calls

## Log Retention

- Development: Last 1000 requests
- Production: Last 7 days
- Older logs archived or sent to monitoring service

## When To Use

- Debugging API errors
- Investigating user issues
- Monitoring performance
- Analyzing usage patterns
- Troubleshooting webhooks
- Identifying bottlenecks

## Related Commands

- `/logs/diagnose-webhook` - Webhook-specific logs
- `/api/test <endpoint>` - Test API endpoint
- `/dev/validate` - Full system validation
- `/db/analyze` - Database performance logs
