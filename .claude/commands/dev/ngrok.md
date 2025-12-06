---
description: Start development server with ngrok tunnel for webhooks
argument-hint:
allowed-tools: Bash(node:*/dev-with-ngrok*.js*)
---

# Start Development with Ngrok

Start the Next.js development server with an ngrok tunnel. This exposes your local server to the internet, enabling webhook testing from services like Stripe and Clerk.

## Arguments

None required. Uses default port 3000.

## Execution

Run the dev server with ngrok:
```bash
node /Users/sanchay/Documents/projects/personal/influencerplatform-wt2/scripts/dev-with-ngrok.js
```

## Output Analysis

Report:

1. **Ngrok Tunnel**:
   - Public URL (https://xxxxx.ngrok.io)
   - Status (connected/failed)
   - Region
   - Tunnel type

2. **Development Server**:
   - Local URL (http://localhost:3000)
   - Server status (running/failed)
   - Environment (development)

3. **Webhook URLs**:
   - Stripe webhook URL
   - Clerk webhook URL
   - Other webhook endpoints

4. **Configuration**:
   - Port number
   - Ngrok config loaded
   - Auth token status

5. **Next Steps**:
   - Update webhook URLs in Stripe dashboard
   - Update webhook URLs in Clerk dashboard
   - Test webhook delivery

## Example Usage

```
/dev/ngrok
```

## What This Does

1. Starts ngrok tunnel on port 3000
2. Starts Next.js dev server
3. Displays public URL for webhooks
4. Keeps running until stopped

## Webhook Configuration

After starting, update webhook URLs in:

**Stripe Dashboard:**
- Go to Developers > Webhooks
- Add endpoint: `https://[ngrok-url]/api/webhooks/stripe`
- Select events: checkout.session.completed, customer.subscription.*

**Clerk Dashboard:**
- Go to Webhooks
- Add endpoint: `https://[ngrok-url]/api/webhooks/clerk`
- Select events: user.created, user.updated, session.created

## Common Issues

### Issue 1: Ngrok Not Installed
**Solution**: Install ngrok: `brew install ngrok` (Mac) or download from ngrok.com

### Issue 2: Ngrok Auth Required
**Solution**: Run `ngrok authtoken YOUR_TOKEN` (get token from ngrok.com)

### Issue 3: Port Already In Use
**Solution**: Kill existing process: `lsof -ti:3000 | xargs kill -9`

### Issue 4: Tunnel Connection Failed
**Solution**: Check internet connection, verify ngrok service status

## Development Workflow

1. Run `/dev/ngrok` to start tunnel and server
2. Copy the ngrok URL displayed
3. Update webhook URLs in service dashboards
4. Test webhook delivery
5. When done, use `/dev/stop-ngrok` to clean up

## Security Notes

- Ngrok URL is public - anyone can access your local server
- Don't commit ngrok URLs to version control
- URL changes each time ngrok restarts (unless using paid ngrok)
- Use webhook signing to verify authenticity

## Monitoring

While running:
- View ngrok dashboard: http://localhost:4040
- See all HTTP requests in real-time
- Inspect webhook payloads
- Replay requests for testing

## Related Commands

- `/dev/stop-ngrok` - Stop ngrok and dev server
- `/dev/check-env` - Verify environment setup
- `/logs/diagnose-webhook` - Debug webhook issues
- `/test/webhook/clerk` - Test Clerk webhooks
