# Slash Commands Reference

This directory contains organized slash commands for instant access to 100+ automation scripts in this codebase.

## Quick Start

Use slash commands like this in Claude Code:
```
/user/reset test@example.com
/test/instagram fitness
/dev/ngrok
```

## Command Namespaces

### 1. `/user/*` - User Management (7 commands)

Manage user accounts, debug user state, and handle subscriptions.

| Command | Description |
|---------|-------------|
| `/user/reset <email>` | Reset user onboarding and data |
| `/user/inspect <email>` | View detailed user state |
| `/user/find <email>` | Find user ID by email |
| `/user/delete <email>` | Permanently delete user |
| `/user/fix-billing <email>` | Fix Stripe sync issues |
| `/user/activate <email> <plan>` | Activate subscription plan |
| `/user/setup-test <email> [plan]` | Quick test user setup |

**Most Used:**
- `/user/reset` - Debug onboarding issues
- `/user/inspect` - Check user state
- `/user/find` - Get user ID quickly

---

### 2. `/db/*` - Database Operations (4 commands)

Database management, analysis, and inspection.

| Command | Description |
|---------|-------------|
| `/db/seed-plans` | Sync Stripe plans to database |
| `/db/analyze` | Analyze database performance |
| `/db/list-users [filter]` | List all users |
| `/db/inspect [table]` | Inspect schema and tables |

**Most Used:**
- `/db/seed-plans` - After Stripe plan changes
- `/db/list-users` - Find test accounts
- `/db/inspect` - Understand schema

---

### 3. `/test/*` - Testing & Quality (7 commands)

Test search providers, APIs, and system functionality.

| Command | Description |
|---------|-------------|
| `/test/instagram <keyword>` | Compare Instagram providers |
| `/test/enrichment [username]` | Test enrichment API |
| `/test/all-searches` | Test all platform searches |
| `/test/apify [keyword]` | Test Apify integration |
| `/test/subscription` | Test billing system |
| `/test/quick` | Quick sanity check |

**Most Used:**
- `/test/instagram` - Validate search quality
- `/test/all-searches` - Pre-deployment check
- `/test/quick` - Fast health check

---

### 4. `/dev/*` - Development Tools (4 commands)

Development workflows, environment validation, and local testing.

| Command | Description |
|---------|-------------|
| `/dev/ngrok` | Start dev server with ngrok |
| `/dev/stop-ngrok` | Stop ngrok tunnel |
| `/dev/check-env` | Validate environment variables |
| `/dev/validate [env]` | Full deployment validation |

**Most Used:**
- `/dev/ngrok` - Test webhooks locally
- `/dev/check-env` - Verify API keys
- `/dev/validate` - Pre-deployment check

---

### 5. `/api/*` - API Testing (1 command)

Test API endpoints with auth bypass for rapid development.

| Command | Description |
|---------|-------------|
| `/api/test <endpoint> [method] [data]` | Test API with auth bypass |

**Examples:**
```
/api/test user/profile
/api/test search/instagram-us-reels POST '{"keyword":"yoga"}'
/api/test campaigns/create POST '{"name":"Test"}'
```

---

### 6. `/logs/*` - Logging & Debugging (2 commands)

View logs and diagnose issues.

| Command | Description |
|---------|-------------|
| `/logs/api [filter]` | View API request logs |
| `/logs/diagnose-webhook [service]` | Diagnose webhook issues |

**Most Used:**
- `/logs/api error` - Find recent errors
- `/logs/diagnose-webhook` - Fix webhook problems

---

## Common Workflows

### New Developer Setup
```
/dev/check-env          # Verify environment
/db/seed-plans          # Sync subscription plans
/user/setup-test test@example.com  # Create test user
/test/quick             # Verify setup
```

### Debug User Issue
```
/user/find user@example.com    # Find user ID
/user/inspect user@example.com # Check state
/user/fix-billing user@example.com  # Fix if needed
/logs/api user         # Check API logs
```

### Test New Search Feature
```
/test/instagram fitness  # Test one keyword
/test/all-searches      # Test all platforms
/logs/api search        # Check for errors
/dev/validate           # Full validation
```

### Local Webhook Testing
```
/dev/check-env          # Verify webhook secrets
/dev/ngrok              # Start tunnel
# Update webhook URLs in Stripe/Clerk
/logs/diagnose-webhook  # Monitor webhooks
/dev/stop-ngrok         # Clean up
```

### Pre-Deployment Checklist
```
/dev/check-env production  # Verify prod env
/test/all-searches         # Test functionality
/db/analyze                # Check database
/dev/validate production   # Full validation
# Deploy if all pass
```

---

## Command Features

All commands include:
- Clear descriptions and argument hints
- Detailed usage examples
- Output interpretation guide
- Common issues and solutions
- Related command suggestions
- Error handling instructions

## Tool Restrictions

Commands use `allowed-tools` to restrict operations:
- Only necessary scripts can be executed
- Prevents accidental destructive operations
- Enables safe command composition

## Auth Bypass for Testing

API testing commands use development auth bypass:
```bash
x-dev-auth: dev-bypass
x-dev-user-id: test-user
```

**Security**: Only works when `NODE_ENV=development`

---

## Adding New Commands

To add a new command:

1. Create `.md` file in appropriate namespace
2. Add frontmatter with description and allowed-tools
3. Document arguments and usage
4. Include examples and error handling
5. Link related commands

**Template:**
```markdown
---
description: One-line description
argument-hint: <required> [optional]
allowed-tools: Bash(node:*/script.js*)
---

# Command Name

[Detailed description]

## Arguments
- `$1`: Description

## Execution
[Command to run]

## Output Analysis
[What to report]

## Example Usage
[Examples]

## Related Commands
[Links to related commands]
```

---

## Tips & Best Practices

**For User Management:**
- Always inspect before deleting
- Use reset instead of delete for testing
- Fix billing before manual changes

**For Testing:**
- Run quick tests frequently
- Run all-searches before deployment
- Check logs after failed tests

**For Development:**
- Check env before starting
- Use ngrok for webhook testing
- Validate before deploying

**For Debugging:**
- Start with inspect/find commands
- Check logs for errors
- Use diagnose commands for webhooks

---

## Statistics

**Total Commands Created:** 25
- User Management: 7
- Database Operations: 4
- Testing: 7
- Development: 4
- API Testing: 1
- Logging: 2

**Scripts Covered:** 30+ most frequently used
**Namespaces:** 6 organized categories

---

## Quick Reference Card

**Daily Development:**
- `/dev/check-env` - Start of day
- `/test/quick` - Before commits
- `/logs/api` - Debugging errors

**User Support:**
- `/user/inspect` - Check user state
- `/user/fix-billing` - Fix billing issues
- `/user/reset` - Reset test users

**Quality Assurance:**
- `/test/instagram` - Search quality
- `/test/all-searches` - Full test suite
- `/dev/validate` - Pre-deployment

**Emergency Debugging:**
- `/logs/api error` - Find errors fast
- `/logs/diagnose-webhook` - Webhook issues
- `/db/analyze` - Database problems

---

## Support

For issues or questions:
1. Check command's "Common Issues" section
2. Run related diagnostic commands
3. Check `/logs/api` for errors
4. Review script source code in `/scripts`

---

**Last Updated:** 2025-10-29
**Command Version:** 1.0
**Total Scripts in Repository:** 100+
