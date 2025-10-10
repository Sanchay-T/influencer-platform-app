# Upgrade User CLI

This guide explains how to promote any account straight to a paid plan (e.g., Fame Flex) without touching the onboarding flow. The CLI uses the shared admin helper so it keeps `users`, `user_subscriptions`, `user_usage`, and `user_billing` in sync.

## Prerequisites

- Run commands from the project root where `scripts/upgrade-user-to-fame-flex.ts` lives.
- Ensure `DATABASE_URL` is exported (the script reads the same connection string the Next.js app uses). For production upgrades run it with the production connection string.
- Node 18+ (same version you use for the app) and `npm` available.

## Basic Usage

```bash
npm exec tsx scripts/upgrade-user-to-fame-flex.ts --email user@example.com
```

What it does:

1. Looks up the user by email (case-insensitive).
2. Fetches the plan row (defaults to `fame_flex`).
3. Marks onboarding as `completed`.
4. Sets subscription + trial status to `active` / `converted` and pushes the renewal a year out.
5. Resets usage counters and sets plan limits to the plan’s configured values (unlimited for Fame Flex).
6. Seeds a manual Stripe subscription/customer id (`manual_admin_grant` / `manual_<plan>`) so PlanValidator considers the account active.
7. Updates system metadata (e.g., `lastWebhookEvent=admin_manual_upgrade`).
8. Prints a table summarizing the new state.

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--email` | Email to promote (required) | — |
| `--plan` | Plan key from `subscription_plans` (e.g. `fame_flex`, `viral_surge`) | `fame_flex` |
| `--keep-onboarding` | Leave onboarding step as `pending` instead of forcing `completed` | off |
| `--skip-usage-reset` | Don’t zero out usage counters; only change limits | off |
| `--no-stripe` | Skip inserting the manual Stripe subscription/customer ids | off |
| `--help` / `-h` | Print usage | — |

### Examples

**Grant Fame Flex to a demo user**
```bash
npm exec tsx scripts/upgrade-user-to-fame-flex.ts --email demo@company.com
```

**Grant Viral Surge but leave onboarding untouched**
```bash
npm exec tsx scripts/upgrade-user-to-fame-flex.ts --email qa@company.com --plan viral_surge --keep-onboarding
```

**Grant Fame Flex but keep existing usage counters**
```bash
npm exec tsx scripts/upgrade-user-to-fame-flex.ts --email bigcustomer@company.com --skip-usage-reset
```

**Grant plan without injecting fake Stripe ids**
```bash
npm exec tsx scripts/upgrade-user-to-fame-flex.ts --email custom@company.com --no-stripe
```

## Troubleshooting

- **User not found**: verify the email exactly matches what’s stored in the DB. The search is case-insensitive but requires the full address.
- **Plan not found**: seed or insert the plan into `subscription_plans` first. Fame Flex is available by default; add additional rows for other SKUs.
- **Database connection errors**: confirm `DATABASE_URL` points at the correct environment (dev vs prod). You can temporarily run `echo $DATABASE_URL` to verify.
- **UI still shows old plan**: ask the user to log out/in or clear `localStorage` keys (`gemz_entitlements_v1`, `gemz_trial_status_v1`). The backend state is correct immediately.

## Next Steps

This CLI is the foundation for the admin plan manager. The same helper (`grantPlanToUserByEmail`) can be reused in an authenticated API endpoint or UI page when you’re ready to offer plan upgrades through the browser.
