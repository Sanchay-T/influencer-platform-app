---
description: Test API endpoint with development auth bypass
argument-hint: <endpoint> [method] [data]
allowed-tools: Bash(curl*)
---

# Test API Endpoint with Auth Bypass

Test any API endpoint using development auth bypass headers. Skips authentication for rapid testing during development.

## Arguments

- `$1`: **[Required]** API endpoint path (e.g., "search/instagram-us-reels", "user/profile")
- `$2`: **[Optional]** HTTP method (GET/POST/PUT/DELETE) - defaults to GET
- `$3`: **[Optional]** JSON request body (for POST/PUT requests)

## Execution

Test the API endpoint:
```bash
curl -X ${2:-GET} http://localhost:3000/api/$1 \
  -H "x-dev-auth: dev-bypass" \
  -H "x-dev-user-id: ${AUTH_BYPASS_USER_ID:-dev-user}" \
  -H "Content-Type: application/json" \
  ${3:+-d "$3"} \
  -w "\n\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  -s -S
```

## Output Analysis

Parse and report:

1. **HTTP Response**:
   - Status code (200, 400, 500, etc.)
   - Status meaning (success, error, etc.)
   - Response time

2. **Response Body**:
   - Full JSON response
   - Key data extracted
   - Error messages if any

3. **Auth Bypass Status**:
   - Auth bypass worked (check response)
   - User ID used
   - Permissions granted

4. **Data Validation**:
   - Response structure valid
   - Required fields present
   - Data types correct

5. **Performance**:
   - Response time acceptable (<2s)
   - No timeout errors
   - Server responsive

## Example Usage

### GET Request:
```
/api/test user/profile
/api/test search/instagram-us-reels?keyword=fitness
```

### POST Request:
```
/api/test campaigns/create POST '{"name":"Test Campaign","platform":"instagram"}'
/api/test search/instagram-us-reels POST '{"keyword":"yoga","limit":10}'
```

### PUT Request:
```
/api/test user/profile PUT '{"name":"Updated Name"}'
```

### DELETE Request:
```
/api/test campaigns/123 DELETE
```

## Auth Bypass Headers

Development auth bypass uses:
- `x-dev-auth: dev-bypass` - Enables bypass mode
- `x-dev-user-id: user-id` - Specifies user for request

**Security Note**: Auth bypass only works in development (NODE_ENV=development). Production deployments reject these headers.

## Common API Endpoints

### User Management:
- `user/profile` - Get/update user profile
- `user/onboarding` - Onboarding status
- `user/subscription` - Subscription info

### Search:
- `search/instagram-us-reels` - Instagram search
- `search/youtube` - YouTube search
- `search/tiktok` - TikTok search

### Campaigns:
- `campaigns` - List campaigns
- `campaigns/create` - Create campaign
- `campaigns/{id}` - Get/update/delete campaign

### Lists:
- `lists` - List creator lists
- `lists/create` - Create list
- `lists/{id}/creators` - Manage creators

### Webhooks:
- `webhooks/stripe` - Stripe webhook
- `webhooks/clerk` - Clerk webhook

## Response Codes

- **200 OK**: Request successful
- **201 Created**: Resource created
- **400 Bad Request**: Invalid input
- **401 Unauthorized**: Auth failed (bypass not working?)
- **404 Not Found**: Endpoint doesn't exist
- **500 Internal Server Error**: Server error

## Common Issues

### Issue 1: 401 Unauthorized
**Solution**: Ensure NODE_ENV=development, auth bypass only works locally

### Issue 2: 404 Not Found
**Solution**: Verify endpoint path is correct, check API routes

### Issue 3: 500 Internal Server Error
**Solution**: Check `/logs/api` for error details

### Issue 4: Invalid JSON
**Solution**: Ensure JSON is properly quoted and escaped

### Issue 5: Timeout
**Solution**: Increase timeout or check if endpoint is hanging

## Testing Workflow

1. Start dev server: `/dev/ngrok` or `npm run dev`
2. Test endpoint: `/api/test <endpoint>`
3. Inspect response and logs
4. Iterate on implementation
5. Check logs if errors: `/logs/api`

## Advanced Usage

### With Query Parameters:
```
/api/test "search/instagram-us-reels?keyword=fitness&limit=20"
```

### With Complex JSON:
```
/api/test campaigns/create POST '{
  "name": "Summer Campaign",
  "platform": "instagram",
  "budget": 5000,
  "startDate": "2024-06-01"
}'
```

### Testing Different Users:
Set AUTH_BYPASS_USER_ID before calling:
```bash
export AUTH_BYPASS_USER_ID=user_123
```
Then run: `/api/test user/profile`

## Related Commands

- `/dev/check-env` - Verify API keys
- `/logs/api` - View API logs
- `/test/all-searches` - Test search endpoints
- `/dev/ngrok` - Start dev server with webhooks
